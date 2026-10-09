import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma.service';
import { MailService } from '../mail/mail.service';
import { resolveStoreNotifyEmailsFromEnv } from '../notifications/notifications.service';
import { aggregatePublishedRatings } from '../reviews/reviews.eligibility';
import {
  ANONYMIZED_NAME,
  DELETION_ACTIONS,
  DELETION_CANCELLED,
  DELETION_PROCESSED,
  DELETION_REQUESTED,
  DELETION_SLA_DAYS,
  OPEN_ORDER_STATUSES,
  PROCESS_BLOCKER_MESSAGE,
  anonymizedEmail,
  cleanDeletionReason,
  deletionStateFromEvents,
  nextEventAt,
  processBlocker,
  type DeletionState,
} from './account-deletion.rules';

function publicState(state: DeletionState) {
  if (state.status === 'pending') {
    return { status: 'pending' as const, requestedAt: state.requestedAt.toISOString(), slaDays: DELETION_SLA_DAYS };
  }
  if (state.status === 'processed') return { status: 'processed' as const, processedAt: state.processedAt.toISOString() };
  return { status: 'none' as const };
}

@Injectable()
export class AccountDeletionService {
  private readonly log = new Logger(AccountDeletionService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MailService) private readonly mail: MailService,
  ) {}

  private async events(userId: string) {
    return this.prisma.auditLog.findMany({
      where: { entity: 'User', entityId: userId, action: { in: [...DELETION_ACTIONS] } },
      select: { action: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async stateOf(userId: string): Promise<DeletionState> {
    return deletionStateFromEvents(await this.events(userId));
  }

  private async nextAt(userId: string): Promise<Date> {
    const ev = await this.events(userId);
    return nextEventAt(new Date(), ev[ev.length - 1]?.createdAt);
  }

  private async openOrders(userId: string) {
    return this.prisma.order.count({
      where: { userId, status: { in: [...OPEN_ORDER_STATUSES] } },
    });
  }

  async status(userId: string) {
    const state = await this.stateOf(userId);
    return { ...publicState(state), openOrders: await this.openOrders(userId) };
  }

  /** Idempotente: um pedido aberto por usuário. Não apaga nada; só registra para a loja processar. */
  async request(userId: string, rawReason?: unknown) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    if (user.role !== 'customer') {
      throw new ConflictException('Conta de equipe: fale com o responsável pela loja.');
    }
    const current = await this.stateOf(userId);
    if (current.status === 'pending') return { ...(await this.status(userId)), created: false };
    if (current.status === 'processed') throw new ConflictException('Esta conta já foi excluída.');

    await this.prisma.auditLog.create({
      data: {
        action: DELETION_REQUESTED,
        actorId: userId,
        entity: 'User',
        entityId: userId,
        meta: { reason: cleanDeletionReason(rawReason), source: 'self_service' } as Prisma.InputJsonValue,
        createdAt: await this.nextAt(userId),
      },
    });
    void this.notifyStore().catch((e) => this.log.warn(`aviso de exclusão não enviado: ${String(e?.message || e)}`));
    return { ...(await this.status(userId)), created: true };
  }

  async cancel(userId: string) {
    const current = await this.stateOf(userId);
    if (current.status !== 'pending') return this.status(userId);
    await this.prisma.auditLog.create({
      data: { action: DELETION_CANCELLED, actorId: userId, entity: 'User', entityId: userId, createdAt: await this.nextAt(userId) },
    });
    return this.status(userId);
  }

  /** Aviso interno sem dado pessoal: só manda abrir o Admin. */
  private async notifyStore() {
    const to = resolveStoreNotifyEmailsFromEnv();
    const day = new Date().toISOString().slice(0, 10);
    for (const addr of to) {
      await this.mail.notifyOpsAlert(
        addr,
        'Novo pedido de exclusão de conta',
        `Um cliente pediu a exclusão da conta pelo site.\nAbra Admin → Clientes → Pedidos de exclusão para processar (prazo informado ao cliente: ${DELETION_SLA_DAYS} dias).`,
        `account-deletion-${day}`,
      );
    }
  }

  async listPending() {
    const events = await this.prisma.auditLog.findMany({
      where: { entity: 'User', action: { in: [...DELETION_ACTIONS] }, entityId: { not: null } },
      select: { action: true, createdAt: true, entityId: true, meta: true },
      orderBy: { createdAt: 'asc' },
      take: 5000,
    });
    const byUser = new Map<string, { action: string; createdAt: Date; meta: unknown }[]>();
    for (const e of events) {
      const list = byUser.get(e.entityId as string) ?? [];
      list.push(e);
      byUser.set(e.entityId as string, list);
    }
    const pending: { userId: string; requestedAt: Date; reason: string | null }[] = [];
    for (const [userId, list] of byUser) {
      const state = deletionStateFromEvents(list);
      if (state.status !== 'pending') continue;
      const last = list[list.length - 1];
      const meta = (last.meta || {}) as { reason?: unknown };
      pending.push({ userId, requestedAt: state.requestedAt, reason: typeof meta.reason === 'string' ? meta.reason : null });
    }
    if (!pending.length) return [];
    const users = await this.prisma.user.findMany({
      where: { id: { in: pending.map((p) => p.userId) } },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        cashbackBalance: true,
        _count: { select: { sellersOwned: true } },
      },
    });
    const open = await this.prisma.order.groupBy({
      by: ['userId'],
      where: { userId: { in: pending.map((p) => p.userId) }, status: { in: [...OPEN_ORDER_STATUSES] } },
      _count: { _all: true },
    });
    const openBy = new Map(open.map((o) => [o.userId, o._count._all]));
    return pending
      .map((p) => {
        const u = users.find((x) => x.id === p.userId);
        if (!u) return null;
        const openOrders = openBy.get(u.id) ?? 0;
        const blocker = processBlocker({
          role: u.role,
          sellersOwned: u._count.sellersOwned,
          openOrders,
          state: { status: 'pending', requestedAt: p.requestedAt },
        });
        return {
          userId: u.id,
          name: u.name,
          email: u.email,
          requestedAt: p.requestedAt.toISOString(),
          reason: p.reason,
          openOrders,
          cashbackBalance: Number(u.cashbackBalance),
          blocker,
          blockerMessage: blocker ? PROCESS_BLOCKER_MESSAGE[blocker] : null,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x))
      .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
  }

  /**
   * Apaga/anonimiza dados pessoais e mantém pedidos, pagamentos, cashback e auditoria
   * (obrigação legal/fiscal e defesa em contestações).
   */
  async process(actorId: string, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, _count: { select: { sellersOwned: true } } },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    const blocker = processBlocker({
      role: user.role,
      sellersOwned: user._count.sellersOwned,
      openOrders: await this.openOrders(userId),
      state: await this.stateOf(userId),
    });
    if (blocker) throw new ConflictException({ code: `ACCOUNT_DELETION_${blocker.toUpperCase()}`, message: PROCESS_BLOCKER_MESSAGE[blocker] });

    const processedAt = await this.nextAt(userId);
    const counts = await this.prisma.$transaction(async (tx) => {
      const reviews = await tx.review.findMany({ where: { userId }, select: { productId: true } });
      const devices = await tx.deviceFcmToken.findMany({ where: { userId }, select: { id: true } });
      const deviceIds = devices.map((d) => d.id);
      const r = {
        reviews: (await tx.review.deleteMany({ where: { userId } })).count,
        addresses: (await tx.address.deleteMany({ where: { userId } })).count,
        favorites: (await tx.favorite.deleteMany({ where: { userId } })).count,
        cartItems: (await tx.cartItem.deleteMany({ where: { cart: { userId } } })).count,
        carts: (await tx.cart.deleteMany({ where: { userId } })).count,
        refreshTokens: (await tx.refreshToken.deleteMany({ where: { userId } })).count,
        passwordResetTokens: (await tx.passwordResetToken.deleteMany({ where: { userId } })).count,
        notifications: (await tx.notification.deleteMany({ where: { userId } })).count,
        productViews: (
          await tx.productViewEvent.deleteMany({
            where: { OR: [{ userId }, ...(deviceIds.length ? [{ deviceId: { in: deviceIds } }] : [])] },
          })
        ).count,
        devices: (await tx.deviceFcmToken.deleteMany({ where: { userId } })).count,
      };
      for (const productId of [...new Set(reviews.map((x) => x.productId))]) {
        const published = await tx.review.findMany({ where: { productId, status: 'published' }, select: { rating: true } });
        const { avg, count } = aggregatePublishedRatings(published.map((x) => x.rating));
        await tx.product.update({ where: { id: productId }, data: { ratingAvg: new Decimal(avg), ratingCount: count } });
      }
      await tx.user.update({
        where: { id: userId },
        data: {
          name: ANONYMIZED_NAME,
          email: anonymizedEmail(userId),
          phone: null,
          cpf: null,
          birthDate: null,
          status: 'blocked',
          passwordHash: `deleted:${randomBytes(32).toString('hex')}`,
        },
      });
      await tx.auditLog.create({
        data: {
          action: DELETION_PROCESSED,
          actorId,
          entity: 'User',
          entityId: userId,
          meta: { counts: r } as unknown as Prisma.InputJsonValue,
          createdAt: processedAt,
        },
      });
      return r;
    });
    return { userId, status: 'processed' as const, deleted: counts };
  }
}
