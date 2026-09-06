import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { formatBRL } from '../../common/whatsapp';

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

@Injectable()
export class NotificationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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

  /** Best-effort: nunca lança. */
  async createSafe(input: CreateNotificationInput) {
    try {
      return await this.create(input);
    } catch {
      return null;
    }
  }

  /**
   * Fan-out best-effort para todos os admins ativos.
   * excludeUserIds: p.ex. o ator da mudança (não notificar a si mesmo).
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
