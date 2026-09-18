import { Inject, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { MailService } from '../mail/mail.service';
import {
  envStoreWhatsApp,
  formatBRL,
  orderWhatsAppMessage,
  waMeUrl,
} from '../../common/whatsapp';
import { buildInAppDedupeWhere, inAppDedupeKey } from './notification-dedupe';
import { structuredLog } from '../../common/structured-log';
import { recordStoreNotifyMailFailure } from './store-notify-mail-ops';

export type CreateNotificationInput = {
  userId: string;
  type: string;
  title: string;
  body?: string;
  linkUrl?: string | null;
  orderId?: string | null;
};

/** Payload in-app para admins quando um pedido é pago. */
export function buildAdminOrderPaidNotification(opts: {
  publicId: string;
  total: number | string;
  orderId?: string | null;
}) {
  return {
    type: 'order_paid',
    title: 'Novo pagamento',
    body: `Pedido ${opts.publicId} pago (${formatBRL(opts.total)})`,
    linkUrl: `/admin`,
    orderId: opts.orderId ?? null,
  } as const;
}

/** Payload in-app para outros admins em mudança de fulfillment. */
export function buildAdminFulfillmentNotification(opts: {
  publicId: string;
  statusLabel: string;
  orderId?: string | null;
}) {
  return {
    type: 'order_status',
    title: 'Status do pedido',
    body: `Pedido ${opts.publicId} agora está: ${opts.statusLabel}.`,
    linkUrl: `/admin`,
    orderId: opts.orderId ?? null,
  } as const;
}

/** URL canônica /admin para e-mails (best-effort). */
export function resolveAdminUrl(): string {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/$/, '');
  if (site) return `${site}/admin`;
  const cors = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)[0]
    ?.replace(/\/$/, '');
  if (cors) return `${cors}/admin`;
  return '/admin';
}


/** Placeholder / seed-only / noreply — never use as sale notify targets. */
export function isPlaceholderStoreEmail(email: string): boolean {
  const e = (email || '').trim().toLowerCase();
  if (!e || !e.includes('@')) return true;
  if (e.endsWith('@lojas-schimitz.test') || e.endsWith('.test')) return true;
  const local = e.split('@', 1)[0];
  // MAIL_FROM often is noreply@ — that must never be the owner inbox.
  if (local === 'noreply' || local === 'no-reply' || local === 'donotreply' || local === 'do-not-reply') {
    return true;
  }
  return false;
}

/** Extrai endereço de MAIL_FROM ("Name <a@b.com>" ou "a@b.com"). */
export function extractEmailAddress(raw: string | undefined | null): string | null {
  const s = (raw || '').trim();
  if (!s) return null;
  const angle = s.match(/<([^>]+)>/);
  const cand = (angle ? angle[1] : s).trim().toLowerCase();
  if (!cand.includes('@') || isPlaceholderStoreEmail(cand)) return null;
  return cand;
}

/**
 * Destinatários extras de venda paga (env), além dos admins no banco.
 * Ordem: STORE_NOTIFY_EMAIL, ADMIN_EMAIL.
 * Não usa MAIL_FROM (costuma ser noreply@ e não é caixa do dono).
 * Dedup + ignora placeholders / noreply.
 */
export function resolveStoreNotifyEmailsFromEnv(env: NodeJS.ProcessEnv = process.env): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw?: string | null) => {
    const e = extractEmailAddress(raw);
    if (!e || seen.has(e)) return;
    seen.add(e);
    out.push(e);
  };
  // STORE_NOTIFY_EMAIL pode ser CSV
  const store = (env.STORE_NOTIFY_EMAIL || '').trim();
  if (store) {
    for (const part of store.split(/[,;]+/)) push(part);
  }
  push(env.ADMIN_EMAIL);
  return out;
}

/**
 * Count unique store-notify recipients (DB admins ∪ env) without returning addresses.
 * Used by GET /admin/ops — never a secret dump.
 */
export function countUniquePaidSaleEmailRecipients(opts: {
  dbEmails?: Array<string | null | undefined>;
  env?: NodeJS.ProcessEnv;
}): number {
  const seen = new Set<string>();
  const push = (raw?: string | null) => {
    const e = (raw || '').trim().toLowerCase();
    if (!e || isPlaceholderStoreEmail(e) || seen.has(e)) return;
    seen.add(e);
  };
  for (const raw of opts.dbEmails || []) push(raw);
  for (const e of resolveStoreNotifyEmailsFromEnv(opts.env)) push(e);
  return seen.size;
}

export type StoreNotifyMailOutcome =
  | 'sent'
  | 'provider_off'
  | 'no_recipients'
  | 'send_failed'
  | 'partial';

export type StoreNotifyPaidResult = {
  inAppCreated: number;
  emailsAttempted: number;
  emailsSent: number;
  emailsFailed: number;
  mailOutcome: StoreNotifyMailOutcome;
  mailConfigured: boolean;
};

/**
 * Mensagem + wa.me para o número da loja (aviso interno de venda paga).
 * Não envia WhatsApp — só deep link click-to-chat.
 */
export function buildStoreOwnerPaidWhatsApp(opts: {
  publicId: string;
  total: number | string;
  customerName?: string | null;
}) {
  const digits = envStoreWhatsApp();
  const text = orderWhatsAppMessage({
    publicId: opts.publicId,
    total: opts.total,
    status: 'paid',
    customerName: opts.customerName,
    kind: 'paid',
    toCustomer: false,
  });
  return { digits, text, url: waMeUrl(digits, text) };
}

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly log = new Logger(NotificationsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MailService) private readonly mail: MailService,
  ) {}

  /**
   * Bootstrap idempotente: se ADMIN_EMAIL (ou STORE_NOTIFY_EMAIL) existir no banco,
   * garante role=admin + status=active para receber in-app "Novo pagamento".
   * Não cria usuário novo (sem senha segura).
   */
  async onModuleInit() {
    await this.ensureEnvAdminsPromoted();
  }

  async ensureEnvAdminsPromoted(): Promise<number> {
    const emails = resolveStoreNotifyEmailsFromEnv();
    let promoted = 0;
    for (const email of emails) {
      try {
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user) {
          this.log.warn(
            'ensureEnvAdminsPromoted: env notify e-mail não cadastrado — cadastre/login ou POST /admin/admins',
          );
          continue;
        }
        if (user.role === 'admin' && user.status === 'active') continue;
        await this.prisma.user.update({
          where: { id: user.id },
          data: { role: 'admin', status: 'active' },
        });
        promoted += 1;
        this.log.log(
          `ensureEnvAdminsPromoted: userId=${user.id} promovido (era role=${user.role} status=${user.status})`,
        );
      } catch (e: any) {
        this.log.error(`ensureEnvAdminsPromoted falhou: ${e?.message || e}`);
      }
    }
    if (promoted) {
      this.log.log(`ensureEnvAdminsPromoted: ${promoted} usuário(s) promovido(s) a admin ativo`);
    }
    return promoted;
  }

  async create(input: CreateNotificationInput) {
    return this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body || '',
        linkUrl: input.linkUrl || null,
        orderId: input.orderId || null,
      },
    });
  }

  /** Best-effort: nunca lança. Dedup in-app por tipo (ver notification-dedupe). */
  async createSafe(input: CreateNotificationInput) {
    try {
      const where = buildInAppDedupeWhere({
        userId: input.userId,
        type: input.type,
        title: input.title,
        orderId: input.orderId,
      });
      if (where) {
        const existing = await this.prisma.notification.findFirst({ where });
        if (existing) {
          // Log sem e-mail / sem PII — só ids de domínio.
          this.log.log(`createSafe skip duplicate key=${inAppDedupeKey(where)}`);
          return existing;
        }
      }
      return await this.create(input);
    } catch (e: any) {
      this.log.warn(`createSafe falhou type=${input.type}: ${e?.message || e}`);
      return null;
    }
  }

  /**
   * Fan-out best-effort para todos os admins ativos.
   * excludeUserIds: p.ex. o ator da mudança de fulfillment (não notificar a si mesmo).
   * Em pagamento confirmado NÃO excluir o comprador — mesmo se for admin.
   */
  async notifyActiveAdmins(
    input: Omit<CreateNotificationInput, 'userId'> & { excludeUserIds?: string[] },
  ): Promise<number> {
    try {
      const exclude = new Set(input.excludeUserIds || []);
      const admins = await this.prisma.user.findMany({
        where: { role: 'admin', status: 'active' },
        select: { id: true },
      });
      let created = 0;
      for (const admin of admins) {
        if (exclude.has(admin.id)) continue;
        const row = await this.createSafe({
          userId: admin.id,
          type: input.type,
          title: input.title,
          body: input.body,
          linkUrl: input.linkUrl,
          orderId: input.orderId,
        });
        if (row) created += 1;
      }
      return created;
    } catch (e: any) {
      this.log.error(`notifyActiveAdmins falhou: ${e?.message || e}`);
      return 0;
    }
  }

  /** Admins ativos com e-mail (para fan-out de venda paga). */
  async listActiveAdmins(): Promise<{ id: string; email: string; name: string | null }[]> {
    try {
      const admins = await this.prisma.user.findMany({
        where: { role: 'admin', status: 'active' },
        select: { id: true, email: true, name: true },
      });
      return admins.filter((a) => Boolean(a.email?.trim()));
    } catch (e: any) {
      this.log.error(`listActiveAdmins falhou: ${e?.message || e}`);
      return [];
    }
  }

  /**
   * Loja sempre avisada em venda paga: in-app para TODOS os admins ativos
   * (incluindo comprador-admin) + e-mail SMTP best-effort + link wa.me no corpo.
   * Sem SMTP: só log; in-app ainda é criada. Não envia WhatsApp Cloud.
   */
  async notifyStoreOfPaidOrder(opts: {
    publicId: string;
    total: number;
    orderId: string;
    customerEmail?: string | null;
    customerName?: string | null;
  }): Promise<StoreNotifyPaidResult> {
    const adminPayload = buildAdminOrderPaidNotification({
      publicId: opts.publicId,
      total: opts.total,
      orderId: opts.orderId,
    });
    // Sem excludeUserIds — comprador admin também recebe "Novo pagamento".
    const inAppCreated = await this.notifyActiveAdmins({ ...adminPayload });

    const whatsapp = buildStoreOwnerPaidWhatsApp({
      publicId: opts.publicId,
      total: opts.total,
      customerName: opts.customerName,
    });
    const adminUrl = resolveAdminUrl();
    const mailCtx = {
      publicId: opts.publicId,
      total: opts.total,
      customerEmail: opts.customerEmail,
      customerName: opts.customerName,
      adminUrl,
      whatsappUrl: whatsapp.url,
    };

    const mailConfigured = this.mail.isConfigured();
    let emailsAttempted = 0;
    let emailsSent = 0;
    let emailsFailed = 0;
    let recipientCount = 0;
    try {
      const storeNotifyConfigured = resolveStoreNotifyEmailsFromEnv().length > 0;
      if (!mailConfigured) {
        this.log.warn(
          `notifyStoreOfPaidOrder: mail provider off (MAIL_FROM + RESEND_API_KEY|SMTP ausentes) — in-app ainda pode ser criada (${opts.publicId})`,
        );
        if (storeNotifyConfigured) {
          structuredLog('warn', 'MAIL_PROVIDER_OFF_STORE_NOTIFY', {
            publicId: opts.publicId,
            orderId: opts.orderId || null,
            storeNotifyConfigured: true,
            mailConfigured: false,
          });
          recordStoreNotifyMailFailure({
            code: 'MAIL_PROVIDER_OFF_STORE_NOTIFY',
            publicId: opts.publicId,
            reason: 'provider_off',
          });
        } else {
          structuredLog('warn', 'MAIL_PROVIDER_OFF', {
            publicId: opts.publicId,
            orderId: opts.orderId || null,
            mailConfigured: false,
          });
          recordStoreNotifyMailFailure({
            code: 'MAIL_PROVIDER_OFF',
            publicId: opts.publicId,
            reason: 'provider_off',
          });
        }
      }
      const recipients = await this.resolvePaidSaleEmailRecipients();
      recipientCount = recipients.length;
      for (const to of recipients) {
        emailsAttempted += 1;
        const r = await this.mail.notifyAdminOrderPaid(to, mailCtx);
        if (r?.sent) {
          emailsSent += 1;
          continue;
        }
        this.log.warn(
          `notifyStoreOfPaidOrder: e-mail não enviado to=*** reason=${r?.reason || 'unknown'} order=${opts.publicId}`,
        );
        structuredLog('warn', 'STORE_EMAIL_SEND_FAILED', {
          publicId: opts.publicId,
          orderId: opts.orderId || null,
          reason: r?.reason || 'unknown',
          mode: r?.mode || null,
        });
        if (r?.reason === 'send_failed') {
          emailsFailed += 1;
          recordStoreNotifyMailFailure({
            code: 'STORE_EMAIL_SEND_FAILED',
            publicId: opts.publicId,
            reason: r.reason,
          });
        }
        // smtp_not_configured → already recorded as provider off; duplicate is not a failure.
      }
      if (recipients.length === 0) {
        this.log.warn(
          `notifyStoreOfPaidOrder: nenhum destinatário de e-mail (DB admin + ADMIN_EMAIL/STORE_NOTIFY_EMAIL) (${opts.publicId})`,
        );
        structuredLog('warn', 'STORE_EMAIL_NO_RECIPIENTS', {
          publicId: opts.publicId,
          orderId: opts.orderId || null,
          storeNotifyConfigured,
        });
        recordStoreNotifyMailFailure({
          code: 'STORE_EMAIL_NO_RECIPIENTS',
          publicId: opts.publicId,
          reason: 'no_recipients',
        });
      } else {
        this.log.log(
          `notifyStoreOfPaidOrder mail recipients=${recipients.length} order=${opts.publicId}`,
        );
      }
    } catch (e: any) {
      this.log.error(`notifyStoreOfPaidOrder e-mail falhou: ${e?.message || e}`);
      structuredLog('error', 'STORE_EMAIL_SEND_FAILED', {
        publicId: opts.publicId,
        orderId: opts.orderId || null,
        error: String(e?.message || e).slice(0, 200),
      });
      emailsFailed += 1;
      recordStoreNotifyMailFailure({
        code: 'STORE_EMAIL_SEND_FAILED',
        publicId: opts.publicId,
        reason: 'exception',
      });
    }

    let mailOutcome: StoreNotifyMailOutcome = 'sent';
    if (!mailConfigured) mailOutcome = 'provider_off';
    else if (emailsFailed > 0 && emailsSent > 0) mailOutcome = 'partial';
    else if (emailsFailed > 0) mailOutcome = 'send_failed';
    else if (recipientCount === 0) mailOutcome = 'no_recipients';
    else mailOutcome = 'sent';

    this.log.log(
      `notifyStoreOfPaidOrder ${opts.publicId}: inApp=${inAppCreated} emails=${emailsAttempted} sent=${emailsSent} failed=${emailsFailed} outcome=${mailOutcome} wa.me=${whatsapp.url.slice(0, 48)}…`,
    );
    return {
      inAppCreated,
      emailsAttempted,
      emailsSent,
      emailsFailed,
      mailOutcome,
      mailConfigured,
    };
  }

  /**
   * União: admins ativos no DB (exceto placeholder *.test) + e-mails de env.
   * Garante que ADMIN_EMAIL/STORE_NOTIFY_EMAIL recebam mesmo se o seed admin for o único no banco.
   */
  async resolvePaidSaleEmailRecipients(): Promise<string[]> {
    const seen = new Set<string>();
    const out: string[] = [];
    const push = (raw?: string | null) => {
      const e = (raw || '').trim().toLowerCase();
      if (!e || isPlaceholderStoreEmail(e) || seen.has(e)) return;
      seen.add(e);
      out.push(e);
    };
    try {
      const admins = await this.listActiveAdmins();
      for (const a of admins) push(a.email);
    } catch (e: any) {
      this.log.warn(`resolvePaidSaleEmailRecipients DB: ${e?.message || e}`);
    }
    for (const e of resolveStoreNotifyEmailsFromEnv()) push(e);
    return out;
  }

  async listForUser(userId: string, opts?: { limit?: number; unreadOnly?: boolean }) {
    const take = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
    const items = await this.prisma.notification.findMany({
      where: {
        userId,
        ...(opts?.unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
    });
    const unreadCount = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });
    return { items, unreadCount };
  }

  async markRead(userId: string, id: string) {
    const n = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!n) throw new NotFoundException('Notificação não encontrada');
    if (n.readAt) return n;
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }
}
