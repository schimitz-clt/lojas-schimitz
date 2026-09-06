import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

export type CreateNotificationInput = {
  userId: string;
  type: string;
  title: string;
  body?: string;
  linkUrl?: string | null;
  orderId?: string | null;
};

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
