import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';
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

type MailSendResult =
  | { sent: true }
  | { sent: false; reason: 'smtp_not_configured' | 'send_failed' };

@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);
  /** Prefer Resend HTTPS when Railway blocks outbound SMTP. */
  private mode: 'resend' | 'smtp' | 'off' = 'off';
  private transporter: Transporter | null = null;
  private from: string | null = null;
  private resendApiKey: string | null = null;

  constructor() {
    this.configureFromEnv();
  }

  /** True when MAIL_FROM + (Resend API key or SMTP transport) are set. */
  isConfigured() {
    return this.mode !== 'off' && Boolean(this.from);
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

    if (from && resendKey) {
      this.from = from;
      this.resendApiKey = resendKey;
      this.mode = 'resend';
      this.transporter = null;
      this.log.log(
        'Resend HTTP API configurado (api.resend.com) — e-mails ativos via HTTPS (SMTP egress ignorado)',
      );
      return;
    }

    if (!host || !from) {
      this.log.log(
        'E-mail não configurado (MAIL_FROM + RESEND_API_KEY ou SMTP_HOST) — e-mails desativados (no-op)',
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
      `SMTP configurado (${host}:${resolvedPort}, secure=${secure}, requireTLS=${!secure && resolvedPort === 587}) — e-mails ativos`,
    );
  }

  private async sendViaResend(
    to: string,
    subject: string,
    text: string,
    html: string,
  ): Promise<MailSendResult> {
    const key = this.resendApiKey;
    const from = this.from;
    if (!key || !from) {
      return { sent: false, reason: 'smtp_not_configured' };
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
        // Never log Authorization / API key; body may mention domain issues only.
        const snippet = bodyText.replace(/\bre_[A-Za-z0-9_]+/g, 're_***').slice(0, 300);
        this.log.error(
          `Falha Resend HTTP (${subject} → ${to}): HTTP ${res.status}${snippet ? ` ${snippet}` : ''}`,
        );
        return { sent: false, reason: 'send_failed' };
      }
      const data = (await res.json().catch(() => null)) as { id?: string } | null;
      this.log.log(
        `E-mail enviado via Resend HTTP: ${subject} → ${to}${data?.id ? ` [id=${data.id}]` : ''}`,
      );
      return { sent: true };
    } catch (e: any) {
      const code = e?.code || '';
      this.log.error(
        `Falha Resend HTTP (${subject} → ${to}): ${e?.message || e}${code ? ` [${code}]` : ''}`,
      );
      return { sent: false, reason: 'send_failed' };
    }
  }

  private async sendViaSmtp(
    to: string,
    subject: string,
    text: string,
    html: string,
  ): Promise<MailSendResult> {
    if (!this.transporter || !this.from) {
      return { sent: false, reason: 'smtp_not_configured' };
    }
    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        text,
        html,
      });
      this.log.log(`E-mail enviado: ${subject} → ${to}`);
      return { sent: true };
    } catch (e: any) {
      const code = e?.code || e?.responseCode || '';
      const hint =
        /timeout|ETIMEDOUT|ECONNECTION|ESOCKET/i.test(String(e?.message || '') + String(code))
          ? ' (dica: Railway bloqueia SMTP egress — use RESEND_API_KEY / Resend HTTP)'
          : '';
      this.log.error(
        `Falha ao enviar e-mail (${subject} → ${to}): ${e?.message || e}${code ? ` [${code}]` : ''}${hint}`,
      );
      return { sent: false, reason: 'send_failed' };
    }
  }

  private async send(to: string, subject: string, text: string, html: string): Promise<MailSendResult> {
    if (this.mode === 'off' || !this.from) {
      this.log.log(`E-mail omitido (mail off): ${subject} → ${to}`);
      return { sent: false, reason: 'smtp_not_configured' };
    }
    if (this.mode === 'resend') {
      return this.sendViaResend(to, subject, text, html);
    }
    return this.sendViaSmtp(to, subject, text, html);
  }

  async notifyOrderPaid(to: string, ctx: OrderMailContext) {
    const { subject, text, html } = orderPaidEmail(ctx);
    return this.send(to, subject, text, html);
  }

  async notifyOrderReadyForPickup(to: string, ctx: OrderMailContext) {
    const { subject, text, html } = orderReadyForPickupEmail(ctx);
    return this.send(to, subject, text, html);
  }

  async notifyOrderShipped(to: string, ctx: OrderMailContext) {
    const { subject, text, html } = orderShippedEmail(ctx);
    return this.send(to, subject, text, html);
  }

  async notifyOrderDelivered(to: string, ctx: OrderMailContext) {
    const { subject, text, html } = orderDeliveredEmail(ctx);
    return this.send(to, subject, text, html);
  }

  async notifyOrderStatus(to: string, ctx: OrderMailContext) {
    const { subject, text, html } = orderStatusEmail(ctx);
    return this.send(to, subject, text, html);
  }

  async notifyAdminOrderPaid(to: string, ctx: AdminOrderPaidMailContext) {
    const { subject, text, html } = adminOrderPaidEmail(ctx);
    return this.send(to, subject, text, html);
  }

  async notifyPasswordReset(to: string, ctx: PasswordResetMailContext) {
    const { subject, text, html } = passwordResetEmail(ctx);
    const result = await this.send(to, subject, text, html);
    // Local/dev: if mail is off, log the reset URL so ops can open it manually.
    // Never put the raw token in API responses or checkpoints.
    if (!result.sent && result.reason === 'smtp_not_configured') {
      this.log.warn(
        `Mail off — password reset link (local only) for ${to}: ${ctx.resetUrl}`,
      );
    }
    return result;
  }
}
