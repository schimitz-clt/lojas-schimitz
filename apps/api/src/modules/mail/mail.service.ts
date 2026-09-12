import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';
import {
  MailProviderMode,
  MailSendKind,
  buildMailIdempotencyKey,
  mailConfiguredFromEnvPresence,
  normalizeMailRecipient,
  resolveMailProviderMode,
} from './mail.config';
import {
  adminOrderPaidEmail,
  AdminOrderPaidMailContext,
  orderDeliveredEmail,
  orderPaidEmail,
  orderReadyForPickupEmail,
  orderShippedEmail,
  orderStatusEmail,
  OrderMailContext,
  passwordResetEmail,
  PasswordResetMailContext,
} from './mail.templates';

export type MailSendResult =
  | { sent: true; mode: MailProviderMode; messageId?: string }
  | {
      sent: false;
      reason: 'smtp_not_configured' | 'send_failed' | 'duplicate';
      mode: MailProviderMode;
    };

/** Process-local TTL for transactional send dedupe (webhook/retry defense). */
const IDEMPOTENCY_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);
  /** Prefer Resend HTTPS when Railway blocks outbound SMTP. */
  private mode: MailProviderMode = 'off';
  private transporter: Transporter | null = null;
  private from: string | null = null;
  private resendApiKey: string | null = null;
  /** key → expiry epoch ms */
  private readonly recentSends = new Map<string, number>();

  constructor() {
    this.configureFromEnv();
  }

  /** True when MAIL_FROM + (Resend API key or SMTP transport) are set. */
  isConfigured() {
    return this.mode !== 'off' && Boolean(this.from);
  }

  /** Runtime provider: resend-http | smtp | off (never includes secrets). */
  getProviderMode(): MailProviderMode {
    return this.mode;
  }

  /**
   * Health/ops signal from env *names* only (MAIL_FROM + RESEND_API_KEY|SMTP_HOST).
   * Does not expose secret values.
   */
  isMailConfiguredFromEnv(): boolean {
    return mailConfiguredFromEnvPresence();
  }

  /**
   * Resend HTTP when:
   * - RESEND_API_KEY is set, or
   * - SMTP_PASS starts with re_ and SMTP_HOST includes "resend" (dual-use key).
   */
  private resolveResendApiKey(): string | null {
    const explicit = process.env.RESEND_API_KEY?.trim();
    if (explicit) return explicit;
    const host = process.env.SMTP_HOST?.trim() || '';
    const pass = process.env.SMTP_PASS ?? '';
    if (pass.startsWith('re_') && /resend/i.test(host)) {
      return pass;
    }
    return null;
  }

  private configureFromEnv() {
    const from = process.env.MAIL_FROM?.trim();
    const host = process.env.SMTP_HOST?.trim();
    const portRaw = process.env.SMTP_PORT?.trim();
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS;
    const resendKey = this.resolveResendApiKey();
    const resolved = resolveMailProviderMode();

    if (from && resendKey && resolved === 'resend-http') {
      this.from = from;
      this.resendApiKey = resendKey;
      this.mode = 'resend-http';
      this.transporter = null;
      this.log.log('mail provider mode=resend-http — e-mails ativos via HTTPS (SMTP egress ignorado)');
      return;
    }

    if (!host || !from || resolved === 'off') {
      this.log.log(
        'mail provider mode=off — MAIL_FROM + RESEND_API_KEY ou SMTP_HOST ausentes (no-op)',
      );
      this.mode = 'off';
      this.transporter = null;
      this.from = null;
      this.resendApiKey = null;
      return;
    }

    const port = Number(portRaw || '587');
    const secure = port === 465;
    const resolvedPort = Number.isFinite(port) ? port : 587;

    this.from = from;
    this.resendApiKey = null;
    this.mode = 'smtp';
    this.transporter = nodemailer.createTransport({
      host,
      port: resolvedPort,
      secure,
      // Railway → Gmail: timeouts claros; 465=SSL, 587=STARTTLS
      requireTLS: !secure && resolvedPort === 587,
      connectionTimeout: 20_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
      auth: user && pass ? { user, pass } : undefined,
    });
    this.log.log(
      `mail provider mode=smtp host=${host} port=${resolvedPort} secure=${secure} — e-mails ativos`,
    );
  }

  private pruneIdempotency(now = Date.now()) {
    for (const [k, exp] of this.recentSends) {
      if (exp <= now) this.recentSends.delete(k);
    }
  }

  /**
   * Claim a send slot. Returns false if a successful/claimed send for this key
   * is still within TTL. Failed sends release the claim so retries work.
   */
  claimIdempotency(key: string | null | undefined): boolean {
    if (!key) return true;
    const now = Date.now();
    if (this.recentSends.size > 500) this.pruneIdempotency(now);
    const exp = this.recentSends.get(key);
    if (exp && exp > now) return false;
    this.recentSends.set(key, now + IDEMPOTENCY_TTL_MS);
    return true;
  }

  /** Release claim after failed send so callers may retry. */
  releaseIdempotency(key: string | null | undefined) {
    if (!key) return;
    this.recentSends.delete(key);
  }

  /** Test helper: clear process-local dedupe map. */
  clearIdempotencyForTests() {
    this.recentSends.clear();
  }

  private async sendViaResend(
    to: string,
    subject: string,
    text: string,
    html: string,
    kind: MailSendKind,
  ): Promise<MailSendResult> {
    const key = this.resendApiKey;
    const from = this.from;
    if (!key || !from) {
      return { sent: false, reason: 'smtp_not_configured', mode: this.mode };
    }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          text,
          html,
        }),
      });
      if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        // Never log Authorization / API key; strip accidental re_ tokens from body.
        const snippet = bodyText.replace(/\bre_[A-Za-z0-9_]+/g, 're_***').slice(0, 200);
        this.log.error(
          `mail fail mode=resend-http kind=${kind} reason=send_failed status=${res.status}${snippet ? ` body=${snippet}` : ''}`,
        );
        return { sent: false, reason: 'send_failed', mode: 'resend-http' };
      }
      const data = (await res.json().catch(() => null)) as { id?: string } | null;
      const messageId = data?.id;
      this.log.log(
        `mail ok mode=resend-http kind=${kind}${messageId ? ` id=${messageId}` : ''}`,
      );
      return { sent: true, mode: 'resend-http', messageId };
    } catch (e: any) {
      const code = e?.code || '';
      this.log.error(
        `mail fail mode=resend-http kind=${kind} reason=send_failed${code ? ` code=${code}` : ''} err=${e?.message || e}`,
      );
      return { sent: false, reason: 'send_failed', mode: 'resend-http' };
    }
  }

  private async sendViaSmtp(
    to: string,
    subject: string,
    text: string,
    html: string,
    kind: MailSendKind,
  ): Promise<MailSendResult> {
    if (!this.transporter || !this.from) {
      return { sent: false, reason: 'smtp_not_configured', mode: this.mode };
    }
    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        text,
        html,
      });
      const messageId = typeof info?.messageId === 'string' ? info.messageId : undefined;
      this.log.log(`mail ok mode=smtp kind=${kind}${messageId ? ` id=${messageId}` : ''}`);
      return { sent: true, mode: 'smtp', messageId };
    } catch (e: any) {
      const code = e?.code || e?.responseCode || '';
      const hint =
        /timeout|ETIMEDOUT|ECONNECTION|ESOCKET/i.test(String(e?.message || '') + String(code))
          ? ' hint=use_resend_http'
          : '';
      this.log.error(
        `mail fail mode=smtp kind=${kind} reason=send_failed${code ? ` code=${code}` : ''} err=${e?.message || e}${hint}`,
      );
      return { sent: false, reason: 'send_failed', mode: 'smtp' };
    }
  }

  private async send(
    to: string,
    subject: string,
    text: string,
    html: string,
    kind: MailSendKind,
    idempotencyKey: string | null,
  ): Promise<MailSendResult> {
    if (this.mode === 'off' || !this.from) {
      this.log.log(`mail skip mode=off kind=${kind} reason=smtp_not_configured`);
      return { sent: false, reason: 'smtp_not_configured', mode: 'off' };
    }

    if (!this.claimIdempotency(idempotencyKey)) {
      this.log.log(`mail skip mode=${this.mode} kind=${kind} reason=duplicate`);
      return { sent: false, reason: 'duplicate', mode: this.mode };
    }

    let result: MailSendResult;
    if (this.mode === 'resend-http') {
      result = await this.sendViaResend(to, subject, text, html, kind);
    } else {
      result = await this.sendViaSmtp(to, subject, text, html, kind);
    }

    if (!result.sent) {
      this.releaseIdempotency(idempotencyKey);
    }
    return result;
  }

  private keyFor(
    kind: MailSendKind,
    to: string,
    ctx: { publicId?: string; statusLabel?: string },
  ): string | null {
    return buildMailIdempotencyKey({
      kind,
      to: normalizeMailRecipient(to),
      publicId: ctx.publicId,
      statusLabel: ctx.statusLabel,
    });
  }

  async notifyOrderPaid(to: string, ctx: OrderMailContext) {
    const { subject, text, html } = orderPaidEmail(ctx);
    return this.send(to, subject, text, html, 'order_paid', this.keyFor('order_paid', to, ctx));
  }

  async notifyOrderReadyForPickup(to: string, ctx: OrderMailContext) {
    const { subject, text, html } = orderReadyForPickupEmail(ctx);
    return this.send(to, subject, text, html, 'order_ready', this.keyFor('order_ready', to, ctx));
  }

  async notifyOrderShipped(to: string, ctx: OrderMailContext) {
    const { subject, text, html } = orderShippedEmail(ctx);
    return this.send(to, subject, text, html, 'order_shipped', this.keyFor('order_shipped', to, ctx));
  }

  async notifyOrderDelivered(to: string, ctx: OrderMailContext) {
    const { subject, text, html } = orderDeliveredEmail(ctx);
    return this.send(
      to,
      subject,
      text,
      html,
      'order_delivered',
      this.keyFor('order_delivered', to, ctx),
    );
  }

  async notifyOrderStatus(to: string, ctx: OrderMailContext) {
    const { subject, text, html } = orderStatusEmail(ctx);
    return this.send(to, subject, text, html, 'order_status', this.keyFor('order_status', to, ctx));
  }

  async notifyAdminOrderPaid(to: string, ctx: AdminOrderPaidMailContext) {
    const { subject, text, html } = adminOrderPaidEmail(ctx);
    return this.send(
      to,
      subject,
      text,
      html,
      'admin_order_paid',
      this.keyFor('admin_order_paid', to, ctx),
    );
  }

  async notifyPasswordReset(to: string, ctx: PasswordResetMailContext) {
    const { subject, text, html } = passwordResetEmail(ctx);
    // No idempotency key — user may request another reset intentionally.
    const result = await this.send(to, subject, text, html, 'password_reset', null);
    // Local/dev: if mail is off, log the reset URL so ops can open it manually.
    // Never put the raw token in API responses or checkpoints.
    if (!result.sent && result.reason === 'smtp_not_configured') {
      this.log.warn(
        `mail off — password reset link (local only) for ${normalizeMailRecipient(to)}: ${ctx.resetUrl}`,
      );
    }
    return result;
  }
}
