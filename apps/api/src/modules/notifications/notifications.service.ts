import { Inject, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { MailService } from '../mail/mail.service';
import {
  envStoreWhatsApp,
  formatBRL,
  orderWhatsAppMessage,
  waMeUrl,
} from '../../common/whatsapp';

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


/** Placeholder / seed-only addresses — never use as sale notify targets. */
export function isPlaceholderStoreEmail(email: string): boolean {
  const e = (email || '').trim().toLowerCase();
  if (!e || !e.includes('@')) return true;
  return e.endsWith('@lojas-schimitz.test') || e.endsWith('.test');
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
 * Ordem: STORE_NOTIFY_EMAIL, ADMIN_EMAIL, e-mail de MAIL_FROM.
 * Dedup + ignora @lojas-schimitz.test / *.test.
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
  push(env.MAIL_FROM);
  return out;
}

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
            `ensureEnvAdminsPromoted: ${email} não cadastrado — cadastre/login na loja ou crie via POST /admin/admins`,
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
          `ensureEnvAdminsPromoted: ${email} promovido (era role=${user.role} status=${user.status})`,
        );
      } catch (e: any) {
        this.log.error(`ensureEnvAdminsPromoted falhou para ${email}: ${e?.message || e}`);
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

  /** Best-effort: nunca lança. Dedup in-app order_paid por user+order. */
  async createSafe(input: CreateNotificationInput) {
    try {
      if (input.orderId && input.type === 'order_paid') {
        const existing = await this.prisma.notification.findFirst({
          where: {
            userId: input.userId,
            orderId: input.orderId,
            type: 'order_paid',
          },
        });
        if (existing) {
          this.log.log(
            `createSafe skip duplicate order_paid user=${input.userId} order=${input.orderId}`,
          );
          return existing;
        }
      }
      return await this.create(input);
    } catch (e: any) {
      this.log.warn(
        `createSafe falhou (${input.type} → user ${input.userId}): ${e?.message || e}`,
      );
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
    } catch {
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
    } catch {
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
  }): Promise<{ inAppCreated: number; emailsAttempted: number }> {
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

    let emailsAttempted = 0;
    try {
      const recipients = await this.resolvePaidSaleEmailRecipients();
      for (const to of recipients) {
        emailsAttempted += 1;
        await this.mail.notifyAdminOrderPaid(to, mailCtx);
      }
      if (recipients.length === 0) {
        this.log.warn(
          `notifyStoreOfPaidOrder: nenhum destinatário de e-mail (DB admin + ADMIN_EMAIL/STORE_NOTIFY_EMAIL/MAIL_FROM) (${opts.publicId})`,
        );
      } else {
        this.log.log(
          `notifyStoreOfPaidOrder mail recipients=${recipients.length} order=${opts.publicId}`,
        );
      }
    } catch (e: any) {
      this.log.error(`notifyStoreOfPaidOrder e-mail falhou: ${e?.message || e}`);
    }

    this.log.log(
      `notifyStoreOfPaidOrder ${opts.publicId}: inApp=${inAppCreated} emails=${emailsAttempted} wa.me=${whatsapp.url.slice(0, 48)}…`,
    );
    return { inAppCreated, emailsAttempted };
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
