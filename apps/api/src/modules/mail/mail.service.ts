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

@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private from: string | null = null;

  constructor() {
    this.configureFromEnv();
  }

  /** True when SMTP_HOST + MAIL_FROM are set. */
  isConfigured() {
    return Boolean(this.transporter && this.from);
  }

  private configureFromEnv() {
    const host = process.env.SMTP_HOST?.trim();
    const from = process.env.MAIL_FROM?.trim();
    const portRaw = process.env.SMTP_PORT?.trim();
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS;

    if (!host || !from) {
      this.log.log('SMTP não configurado (SMTP_HOST/MAIL_FROM) — e-mails desativados (no-op)');
      this.transporter = null;
      this.from = null;
      return;
    }

    const port = Number(portRaw || '587');
    const secure = port === 465;
    const resolvedPort = Number.isFinite(port) ? port : 587;

    this.from = from;
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

  private async send(to: string, subject: string, text: string, html: string) {
    if (!this.transporter || !this.from) {
      this.log.log(`E-mail omitido (SMTP off): ${subject} → ${to}`);
      return { sent: false, reason: 'smtp_not_configured' as const };
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
      return { sent: true as const };
    } catch (e: any) {
      const code = e?.code || e?.responseCode || '';
      const hint =
        /timeout|ETIMEDOUT|ECONNECTION|ESOCKET/i.test(String(e?.message || '') + String(code))
          ? ' (dica: tente SMTP_PORT=465 com SSL, ou provedor tipo Resend; confira firewall Railway→SMTP)'
          : '';
      this.log.error(
        `Falha ao enviar e-mail (${subject} → ${to}): ${e?.message || e}${code ? ` [${code}]` : ''}${hint}`,
      );
      return { sent: false, reason: 'send_failed' as const };
    }
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
    // Local/dev: if SMTP is off, log the reset URL so ops can open it manually.
    // Never put the raw token in API responses or checkpoints.
    if (!result.sent && result.reason === 'smtp_not_configured') {
      this.log.warn(
        `SMTP off — password reset link (local only) for ${to}: ${ctx.resetUrl}`,
      );
    }
    return result;
  }
}
