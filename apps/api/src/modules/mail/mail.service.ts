import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';
import {
  orderDeliveredEmail,
  orderPaidEmail,
  orderReadyForPickupEmail,
  orderShippedEmail,
  orderStatusEmail,
  OrderMailContext,
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

    this.from = from;
    this.transporter = nodemailer.createTransport({
      host,
      port: Number.isFinite(port) ? port : 587,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });
    this.log.log(`SMTP configurado (${host}:${port}) — e-mails ativos`);
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
      this.log.error(`Falha ao enviar e-mail (${subject} → ${to}): ${e?.message || e}`);
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
}
