import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { randomUUID } from 'crypto';
import { CreateOrderDto } from './dto';
import { canonicalOrderHash, requireIdempotencyKey } from './idempotency';
import { Decimal } from '@prisma/client/runtime/library';
import { InventoryService } from '../inventory/inventory.service';
import { AuditService } from '../../common/audit.service';
import { ShippingProvider } from '../shipping/shipping.provider';
import { Inject, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PaymentProvider } from '../payments/payment.provider';
import {
  canTransition,
  orderStatusLabel,
  type FulfillmentStatus,
} from '../../common/order-status';
import { MailService } from '../mail/mail.service';
import { CouponsService } from '../coupons/coupons.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import {
  NotificationsService,
  buildAdminOrderPaidNotification,
  buildAdminFulfillmentNotification,
} from '../notifications/notifications.service';

type AdminFulfillmentTarget =
  | FulfillmentStatus
  | 'separating'
  | 'shipped';

@Injectable()
export class OrdersService {
  private readonly log = new Logger(OrdersService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(InventoryService) private readonly inventory: InventoryService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject('ShippingProvider') private readonly shipping: ShippingProvider,
    @Inject('PaymentProvider') private readonly paymentsProvider: PaymentProvider,
    @Inject(MailService) private readonly mail: MailService,
    @Inject(CouponsService) private readonly coupons: CouponsService,
    @Inject(LoyaltyService) private readonly loyalty: LoyaltyService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  private publicId() {
    return `SCH-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;
  }

  private scopedKey(userId: string, key: string) {
    return `${userId}:${key}`;
  }

  private hashPayload(dto: CreateOrderDto, items: { productId: string; qty: number }[]) {
    return canonicalOrderHash({
      addressId: dto.addressId,
      couponCode: dto.couponCode,
      cashbackAmount: dto.cashbackAmount ?? 0,
      items,
    });
  }

  private isUniqueViolation(e: unknown) {
    return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
  }

  private async recordStatusHistory(
    tx: Prisma.TransactionClient,
    orderId: string,
    toStatus: string,
    opts?: { fromStatus?: string | null; actorId?: string | null; note?: string | null },
  ) {
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        fromStatus: opts?.fromStatus ?? null,
        toStatus,
        actorId: opts?.actorId ?? null,
        note: opts?.note ?? null,
      },
    });
  }

  async create(userId: string, dto: CreateOrderDto, idempotencyKeyRaw?: string) {
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyRaw);
    const scoped = this.scopedKey(userId, idempotencyKey);

    const loadExistingOrder = () =>
      this.prisma.order.findFirst({
        where: { userId, idempotencyKey },
        include: { items: true, payments: true, statusHistory: { orderBy: { createdAt: 'asc' } } },
      });

    const existingOrder = await loadExistingOrder();
    const existingRec = await this.prisma.idempotencyRecord.findUnique({ where: { key: scoped } });

    const cart = await this.prisma.cart.findFirst({
      where: { userId },
      include: { items: { include: { product: { include: { inventory: true } } } } },
    });
    const cartItems = cart?.items ?? [];

    if (existingRec?.status === 'completed' && existingRec.response) {
      const replayItems = existingOrder
        ? existingOrder.items.map((i) => ({ productId: i.productId, qty: i.qty }))
        : [];
      if (replayItems.length) {
        const replayHash = this.hashPayload(dto, replayItems);
        if (existingRec.requestHash && existingRec.requestHash !== '' && existingRec.requestHash !== replayHash) {
          throw new ConflictException({
            message: 'Idempotency-Key já usada com outro payload',
            code: 'IDEMPOTENCY_KEY_REUSED',
          });
        }
      }
      return existingRec.response as object;
    }

    if (!cartItems.length && existingOrder) {
      const replayHash = this.hashPayload(
        dto,
        existingOrder.items.map((i) => ({ productId: i.productId, qty: i.qty })),
      );
      if (existingRec?.requestHash && existingRec.requestHash !== '' && existingRec.requestHash !== replayHash) {
        throw new ConflictException({
          message: 'Idempotency-Key já usada com outro payload',
          code: 'IDEMPOTENCY_KEY_REUSED',
        });
      }
      return existingOrder;
    }

    const incomingHash = this.hashPayload(
      dto,
      cartItems.map((i) => ({ productId: i.productId, qty: i.qty })),
    );

    if (existingRec?.requestHash && existingRec.requestHash !== '' && existingRec.requestHash !== incomingHash) {
      throw new ConflictException({
        message: 'Idempotency-Key já usada com outro payload',
        code: 'IDEMPOTENCY_KEY_REUSED',
      });
    }

    if (existingOrder) return existingOrder;

    try {
      await this.prisma.idempotencyRecord.create({
        data: { key: scoped, userId, requestHash: incomingHash, status: 'pending' },
      });
    } catch (e) {
      if (!this.isUniqueViolation(e)) throw e;
      const rec = await this.prisma.idempotencyRecord.findUnique({ where: { key: scoped } });
      if (rec?.requestHash && rec.requestHash !== incomingHash && rec.requestHash !== '') {
        throw new ConflictException({
          message: 'Idempotency-Key já usada com outro payload',
          code: 'IDEMPOTENCY_KEY_REUSED',
        });
      }
      if (rec?.status === 'completed' && rec.response) return rec.response as object;
      const raced = await loadExistingOrder();
      if (raced) return raced;
    }

    const address = await this.prisma.address.findFirst({
      where: { id: dto.addressId, userId },
    });
    if (!address) throw new NotFoundException('Endereço não encontrado');
    const buyer = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true },
    });

    if (!cart || cart.items.length === 0) throw new BadRequestException('Carrinho vazio');

    for (const item of cart.items) {
      if (item.qty < 1) throw new BadRequestException('Quantidade inválida');
      if (!item.product.active) throw new BadRequestException(`Produto "${item.product.name}" indisponível`);
      // Preflight: bloqueia oversell antes da tx (CAS na tx ainda é a fonte da verdade).
      const inv = item.product.inventory;
      if (!inv) {
        throw new BadRequestException({
          message: `Produto "${item.product.name}" sem inventário configurado`,
          code: 'INVENTORY_MISSING',
        });
      }
      const available = this.inventory.available(inv.qtyOnHand, inv.qtyReserved);
      if (available < item.qty) {
        throw new BadRequestException({
          message: `Estoque insuficiente para "${item.product.name}"`,
          code: 'INSUFFICIENT_STOCK',
        });
      }
    }

    const subtotal = cart.items.reduce((s, i) => s + Number(i.product.price) * i.qty, 0);
    let discount = new Decimal(0);
    let couponId: string | undefined;
    let cashbackUsed = new Decimal(0);

    if (dto.couponCode) {
      const validated = await this.coupons.validate(dto.couponCode, subtotal);
      discount = new Decimal(validated.discount);
      couponId = validated.id;
    }

    const requestedCashback = Number(dto.cashbackAmount || 0);
    if (requestedCashback < 0) throw new BadRequestException('Valor de cashback inválido');
    if (requestedCashback > 0) {
      const { balance } = await this.loyalty.getBalance(userId);
      if (requestedCashback > balance + 0.0001) {
        throw new BadRequestException({
          message: 'Saldo SCHIMITZ+ insuficiente',
          code: 'CASHBACK_INSUFFICIENT',
        });
      }
      const maxApplicable = Math.max(0, subtotal - Number(discount));
      cashbackUsed = new Decimal(Math.min(requestedCashback, maxApplicable));
      cashbackUsed = new Decimal(cashbackUsed.toDecimalPlaces(2));
    }

    const quote = await this.shipping.quote({
      cep: address.cep,
      subtotal,
      items: cart.items.map((i) => ({ qty: i.qty, weightKg: i.product.weightKg ? Number(i.product.weightKg) : undefined })),
    });
    const freight = quote.price;
    const totalDiscount = Number(discount) + Number(cashbackUsed);
    const total = Math.max(0, subtotal - totalDiscount + freight);
    const reservationExpiresAt = new Date(Date.now() + 30 * 60 * 1000);

    try {
      const order = await this.prisma.$transaction(async (tx) => {
        if (idempotencyKey) {
          const raced = await tx.order.findFirst({
            where: { userId, idempotencyKey },
            include: { items: true, payments: true, statusHistory: { orderBy: { createdAt: 'asc' } } },
          });
          if (raced) return raced;
        }

        const created = await tx.order.create({
          data: {
            publicId: this.publicId(),
            userId,
            status: 'awaiting_payment',
            subtotal: new Decimal(subtotal),
            discount,
            cashbackUsed,
            freight: new Decimal(freight),
            total: new Decimal(total),
            couponId,
            idempotencyKey: idempotencyKey || null,
            reservationExpiresAt,
            freightSnap: quote as object,
            addressSnap: {
              label: address.label,
              cep: address.cep,
              street: address.street,
              number: address.number,
              complement: address.complement,
              district: address.district,
              city: address.city,
              uf: address.uf,
              phone: buyer?.phone || null,
            },
            items: {
              create: cart.items.map((i) => ({
                productId: i.productId,
                name: i.product.name,
                qty: i.qty,
                unitPrice: i.product.price,
              })),
            },
          },
          include: { items: true, payments: true, statusHistory: { orderBy: { createdAt: 'asc' } } },
        });

        for (const item of cart.items) {
          await this.inventory.reserve(tx, item.productId, item.qty);
        }
        if (couponId) await this.inventory.reserveCoupon(tx, couponId);
        if (Number(cashbackUsed) > 0) {
          await this.loyalty.redeemInTx(tx, userId, created.id, Number(cashbackUsed));
        }
        await this.recordStatusHistory(tx, created.id, 'awaiting_payment', {
          fromStatus: 'draft',
          actorId: userId,
          note: 'order_created',
        });
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
        return tx.order.findUniqueOrThrow({
          where: { id: created.id },
          include: { items: true, payments: true, statusHistory: { orderBy: { createdAt: 'asc' } } },
        });
      });

      if (scoped) {
        await this.prisma.idempotencyRecord.update({
          where: { key: scoped },
          data: { status: 'completed', requestHash: incomingHash, response: order as object },
        }).catch(() => undefined);
      }

      await this.audit.log('order.created', {
        actorId: userId,
        entity: 'Order',
        entityId: order.id,
        meta: { publicId: order.publicId, total },
      });
      return order;
    } catch (e) {
      if (this.isUniqueViolation(e) && idempotencyKey) {
        const existing = await this.prisma.order.findFirst({
          where: { userId, idempotencyKey },
          include: { items: true, payments: true, statusHistory: { orderBy: { createdAt: 'asc' } } },
        });
        if (existing) return existing;
      }
      throw e;
    }
  }

  async list(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: { items: true, payments: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getByPublicId(userId: string, publicId: string) {
    const order = await this.prisma.order.findFirst({
      where: { publicId, userId },
      include: {
        items: true,
        payments: true,
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!order) throw new NotFoundException('Pedido não encontrado');
    return order;
  }

  /** Somente quem ganha awaiting_payment → cancelled libera reserva. */
  async cancel(userId: string, publicId: string) {
    const found = await this.prisma.order.findFirst({ where: { publicId, userId } });
    if (!found) throw new NotFoundException('Pedido não encontrado');
    const won = await this.transitionFromAwaiting(found.id, 'cancelled');
    if (!won) {
      const current = await this.prisma.order.findUnique({
        where: { id: found.id },
        include: { items: true, payments: true, statusHistory: { orderBy: { createdAt: 'asc' } } },
      });
      if (current?.status === 'cancelled') return current;
      throw new BadRequestException('Pedido não pode ser cancelado neste estado');
    }
    await this.audit.log('order.cancelled', { actorId: userId, entity: 'Order', entityId: found.id });
    await this.notifyCustomerInApp(found.userId, found.id, found.publicId, 'cancelled');
    return this.prisma.order.findUnique({
      where: { id: found.id },
      include: { items: true, payments: true, statusHistory: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async markPaid(orderId: string) {
    const won = await this.transitionFromAwaiting(orderId, 'paid');
    if (!won) {
      const current = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true, payments: true, statusHistory: { orderBy: { createdAt: 'asc' } } },
      });
      if (current?.status === 'paid') return current;
      throw new BadRequestException({ message: 'Transição inválida (já cancelado ou pago)', code: 'INVALID_TRANSITION' });
    }
    await this.audit.log('order.paid', { entity: 'Order', entityId: orderId });
    await this.loyalty.creditEarnOnPaid(orderId).catch((e) => {
      this.log.warn(`cashback earn falhou para ${orderId}: ${e?.message || e}`);
    });
    const paid = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, payments: true, statusHistory: { orderBy: { createdAt: 'asc' } }, user: { select: { email: true, name: true } } },
    });
    if (paid) {
      await this.notifyCustomerInApp(paid.userId, paid.id, paid.publicId, 'paid');
      const adminPayload = buildAdminOrderPaidNotification({
        publicId: paid.publicId,
        total: Number(paid.total),
        orderId: paid.id,
      });
      await this.notifications.notifyActiveAdmins({
        ...adminPayload,
        excludeUserIds: paid.userId ? [paid.userId] : [],
      });
      if (paid.user?.email) {
        await this.mail.notifyOrderPaid(paid.user.email, {
          publicId: paid.publicId,
          total: Number(paid.total),
          customerName: paid.user.name,
        }).catch(() => undefined);
      }
    }
    return paid;
  }

  async expireReservations() {
    const expired = await this.prisma.order.findMany({
      where: { status: 'awaiting_payment', reservationExpiresAt: { lt: new Date() } },
      select: { id: true, userId: true, publicId: true },
    });
    let count = 0;
    const remoteCancelIds: string[] = [];
    for (const o of expired) {
      const won = await this.transitionFromAwaiting(o.id, 'cancelled');
      if (won) {
        count += 1;
        await this.notifyCustomerInApp(o.userId, o.id, o.publicId, 'cancelled', 'Reserva expirada — pedido cancelado');
        const pendings = await this.prisma.payment.findMany({
          where: { orderId: o.id, status: 'pending' },
          select: { id: true, externalId: true },
        });
        for (const p of pendings) {
          const rows = await this.prisma.$executeRaw`
            UPDATE "Payment"
            SET "status" = 'expired'::"PaymentStatus"
            WHERE "id" = ${p.id}
              AND "status" = 'pending'::"PaymentStatus"
          `;
          if (rows > 0) {
            if (p.externalId) remoteCancelIds.push(p.externalId);
            await this.audit.log('payment.expired', {
              entity: 'Payment',
              entityId: p.id,
              meta: { orderId: o.id, via: 'reservation_expiry' },
            });
          }
        }
      }
    }
    for (const ext of remoteCancelIds) {
      try {
        await this.paymentsProvider.cancelIntent(ext);
      } catch (e) {
        this.log.warn(`cancelIntent best-effort falhou para ${ext}`);
      }
    }
    return { expired: count };
  }

  /**
   * UPDATE condicional: só o processo que altera awaiting_payment libera estoque/cupom.
   * paid → commitSale (decrementa on-hand); cancelled → release (libera reserva).
   */
  async transitionFromAwaiting(orderId: string, to: 'paid' | 'cancelled'): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$executeRaw`
        UPDATE "Order"
        SET "status" = ${to}::"OrderStatus",
            "reservationExpiresAt" = NULL
        WHERE "id" = ${orderId}
          AND "status" = 'awaiting_payment'::"OrderStatus"
      `;
      if (rows === 0) return false;

      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order) return false;

      await this.recordStatusHistory(tx, orderId, to, {
        fromStatus: 'awaiting_payment',
        note: to === 'paid' ? 'payment_confirmed' : 'cancelled_or_expired',
      });

      if (to === 'cancelled') {
        for (const item of order.items) {
          await this.inventory.release(tx, item.productId, item.qty);
        }
        if (order.couponId) await this.inventory.releaseCoupon(tx, order.couponId);
        if (order.userId && Number(order.cashbackUsed) > 0) {
          await this.loyalty.refundRedeemInTx(tx, order.userId, order.id, Number(order.cashbackUsed));
        }
      } else {
        for (const item of order.items) {
          await this.inventory.commitSale(tx, item.productId, item.qty);
        }
        if (order.couponId) await this.inventory.consumeCoupon(tx, order.couponId);
      }
      return true;
    });
  }

  /**
   * Admin: avança fulfillment (paid→organizing→packing→ready_for_pickup→in_transit→delivered).
   * Sem side-effects de estoque; UPDATE condicional anti-corrida.
   */
  async adminUpdateFulfillmentStatus(adminId: string, orderId: string, to: AdminFulfillmentTarget) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Pedido não encontrado');
    if (!canTransition(order.status, to)) {
      throw new BadRequestException({
        message: `Transição inválida: ${order.status} → ${to}`,
        code: 'INVALID_TRANSITION',
      });
    }
    const from = order.status;
    const rows = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.$executeRaw`
        UPDATE "Order"
        SET "status" = ${to}::"OrderStatus"
        WHERE "id" = ${orderId}
          AND "status" = ${from}::"OrderStatus"
      `;
      if (updated === 0) return 0;
      await this.recordStatusHistory(tx, orderId, to, {
        fromStatus: from,
        actorId: adminId,
        note: 'admin_fulfillment',
      });
      return updated;
    });
    if (rows === 0) {
      throw new ConflictException('Pedido alterado por outro processo; recarregue');
    }
    await this.audit.log('order.fulfillment_updated', {
      actorId: adminId,
      entity: 'Order',
      entityId: orderId,
      meta: { from, to },
    });
    const updated = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        payments: true,
        statusHistory: { orderBy: { createdAt: 'asc' } },
        user: { select: { email: true, name: true } },
      },
    });
    if (updated) {
      await this.notifyCustomerInApp(updated.userId, updated.id, updated.publicId, to);
      await this.notifyFulfillmentEmail(updated, to);
      // Outros admins ativos (não o ator) — best-effort.
      const adminPayload = buildAdminFulfillmentNotification({
        publicId: updated.publicId,
        statusLabel: orderStatusLabel(to),
        orderId: updated.id,
      });
      await this.notifications.notifyActiveAdmins({
        ...adminPayload,
        excludeUserIds: [adminId],
      });
    }
    return updated;
  }

  private async notifyCustomerInApp(
    userId: string | null | undefined,
    orderId: string,
    publicId: string,
    status: string,
    overrideBody?: string,
  ) {
    if (!userId) return;
    const label = orderStatusLabel(status);
    const title =
      status === 'paid'
        ? 'Pedido pago'
        : status === 'cancelled'
          ? 'Pedido cancelado'
          : `Pedido: ${label}`;
    const body =
      overrideBody ||
      (status === 'paid'
        ? `Recebemos o pagamento do pedido ${publicId}.`
        : status === 'cancelled'
          ? `O pedido ${publicId} foi cancelado.`
          : `Seu pedido ${publicId} agora está: ${label}.`);
    await this.notifications.createSafe({
      userId,
      type: status === 'paid' ? 'order_paid' : status === 'cancelled' ? 'order_cancelled' : 'order_status',
      title,
      body,
      linkUrl: `/pedidos/${publicId}`,
      orderId,
    });
  }

  /** Best-effort: e-mails de fulfillment. Nunca lança. */
  private async notifyFulfillmentEmail(
    order: {
      id: string;
      publicId: string;
      total: unknown;
      user?: { email: string; name: string } | null;
    },
    status: string,
  ) {
    try {
      const to = order.user?.email;
      if (!to) {
        this.log.warn(`Fulfillment ${status} sem e-mail: ${order.id}`);
        return;
      }
      const ctx = {
        publicId: order.publicId,
        total: Number(order.total),
        customerName: order.user?.name,
        statusLabel: orderStatusLabel(status),
      };
      if (status === 'ready_for_pickup') {
        await this.mail.notifyOrderReadyForPickup(to, ctx);
      } else if (status === 'in_transit' || status === 'shipped') {
        await this.mail.notifyOrderShipped(to, ctx);
      } else if (status === 'delivered') {
        await this.mail.notifyOrderDelivered(to, ctx);
      } else if (status === 'packing' || status === 'organizing') {
        await this.mail.notifyOrderStatus(to, ctx);
      }
    } catch (e: any) {
      this.log.error(`notifyFulfillmentEmail falhou: ${e?.message || e}`);
    }
  }
}
