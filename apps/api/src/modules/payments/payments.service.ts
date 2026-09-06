import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { AuditService } from '../../common/audit.service';
import { OrdersService } from '../orders/orders.service';
import { InventoryService } from '../inventory/inventory.service';
import { requireIdempotencyKey } from '../orders/idempotency';
import {
  DomainPaymentStatus,
  PaymentProvider,
  VerifiedWebhookEvent,
} from './payment.provider';
import { CreatePaymentIntentDto } from './dto';
import { MailService } from '../mail/mail.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import {
  NotificationsService,
  buildAdminOrderPaidNotification,
} from '../notifications/notifications.service';
import { isRefundAllowed, shouldRestockOnRefund } from '../../common/order-status';

const MVP_METHODS = new Set(['pix', 'card']);

@Injectable()
export class PaymentsService {
  private readonly log = new Logger(PaymentsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(OrdersService) private readonly orders: OrdersService,
    @Inject(InventoryService) private readonly inventory: InventoryService,
    @Inject('PaymentProvider') private readonly provider: PaymentProvider,
    @Inject(MailService) private readonly mail: MailService,
    @Inject(LoyaltyService) private readonly loyalty: LoyaltyService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  private scopedIntentKey(userId: string, key: string) {
    // Prefixo evita colisão com Idempotency-Key do checkout (#8).
    return `payintent:${userId}:${key}`;
  }

  private intentHash(orderId: string, method: string) {
    return createHash('sha256').update(JSON.stringify({ orderId, method })).digest('hex');
  }

  private isUniqueViolation(e: unknown) {
    return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
  }

  private serializePayment(p: any) {
    return {
      id: p.id,
      orderId: p.orderId,
      provider: p.provider,
      method: p.method,
      status: p.status,
      externalId: p.externalId,
      amount: Number(p.amount),
      payload: p.payload ?? null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  async createIntent(userId: string, dto: CreatePaymentIntentDto, idempotencyKeyRaw?: string) {
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyRaw);
    const scoped = this.scopedIntentKey(userId, idempotencyKey);
    const requestHash = this.intentHash(dto.orderId, dto.method);

    if (!MVP_METHODS.has(dto.method)) {
      throw new BadRequestException({
        message: 'Método de pagamento indisponível no MVP',
        code: 'METHOD_NOT_AVAILABLE',
      });
    }

    const existingRec = await this.prisma.idempotencyRecord.findUnique({ where: { key: scoped } });
    if (existingRec?.requestHash && existingRec.requestHash !== requestHash) {
      throw new ConflictException({
        message: 'Idempotency-Key já usada com outro payload',
        code: 'IDEMPOTENCY_KEY_REUSED',
      });
    }
    if (existingRec?.status === 'completed' && existingRec.response) {
      return existingRec.response as object;
    }

    const order = await this.prisma.order.findFirst({
      where: { id: dto.orderId },
      include: { user: { select: { email: true } }, payments: true },
    });
    if (!order) throw new NotFoundException({ message: 'Pedido não encontrado', code: 'ORDER_NOT_FOUND' });
    if (order.userId !== userId) {
      throw new ForbiddenException({ message: 'Pedido de outro usuário', code: 'ORDER_FORBIDDEN' });
    }
    if (order.status !== 'awaiting_payment') {
      throw new BadRequestException({
        message: 'Pedido não está aguardando pagamento',
        code: 'ORDER_NOT_AWAITING_PAYMENT',
      });
    }
    if (!order.reservationExpiresAt || order.reservationExpiresAt.getTime() <= Date.now()) {
      throw new BadRequestException({
        message: 'Reserva do pedido expirada',
        code: 'RESERVATION_EXPIRED',
      });
    }
    if (!order.addressSnap) {
      throw new BadRequestException({ message: 'Pedido sem endereço', code: 'ADDRESS_REQUIRED' });
    }

    const hasApproved = order.payments.some((p) => p.status === 'approved');
    if (hasApproved) {
      throw new ConflictException({
        message: 'Pedido já possui pagamento aprovado',
        code: 'PAYMENT_ALREADY_APPROVED',
      });
    }

    const pending = order.payments.find((p) => p.status === 'pending');
    if (pending) {
      // Replay da mesma key → devolve a pending; key nova com pending existente → conflito de domínio (#5)
      if (existingRec?.status === 'completed' && existingRec.response) {
        return existingRec.response as object;
      }
      // Se a idempotency record aponta para completar a mesma operação, segue; senão bloqueia.
      if (!existingRec || existingRec.status !== 'pending') {
        throw new ConflictException({
          message: 'Já existe uma intenção de pagamento pendente para este pedido',
          code: 'PAYMENT_PENDING_EXISTS',
        });
      }
    }

    try {
      await this.prisma.idempotencyRecord.create({
        data: { key: scoped, userId, requestHash, status: 'pending' },
      });
    } catch (e) {
      if (!this.isUniqueViolation(e)) throw e;
      const rec = await this.prisma.idempotencyRecord.findUnique({ where: { key: scoped } });
      if (rec?.requestHash && rec.requestHash !== requestHash) {
        throw new ConflictException({
          message: 'Idempotency-Key já usada com outro payload',
          code: 'IDEMPOTENCY_KEY_REUSED',
        });
      }
      if (rec?.status === 'completed' && rec.response) return rec.response as object;
    }

    if (dto.method === 'card' && !dto.cardToken && this.provider.name === 'mercadopago') {
      throw new BadRequestException({
        message: 'cardToken obrigatório para pagamento com cartão',
        code: 'CARD_TOKEN_REQUIRED',
      });
    }

    // Tx curta: cria Payment pending local (#12)
    let payment;
    try {
      payment = await this.prisma.$transaction(async (tx) => {
        const again = await tx.payment.findFirst({
          where: { orderId: order.id, status: { in: ['pending', 'approved'] } },
        });
        if (again?.status === 'approved') {
          throw new ConflictException({
            message: 'Pedido já possui pagamento aprovado',
            code: 'PAYMENT_ALREADY_APPROVED',
          });
        }
        if (again?.status === 'pending') {
          return again;
        }
        return tx.payment.create({
          data: {
            orderId: order.id,
            provider: this.provider.name === 'null' ? 'null' : 'mercadopago',
            method: dto.method,
            status: 'pending',
            amount: order.total,
          },
        });
      });
    } catch (e) {
      if (this.isUniqueViolation(e)) {
        throw new ConflictException({
          message: 'Já existe uma intenção de pagamento pendente para este pedido',
          code: 'PAYMENT_PENDING_EXISTS',
        });
      }
      throw e;
    }

    // Se já tinha externalId (replay incompleto), tenta fetch; senão createIntent remoto.
    if (payment.externalId) {
      const response = {
        payment: this.serializePayment(payment),
        orderId: order.id,
        publicId: order.publicId,
      };
      await this.prisma.idempotencyRecord.update({
        where: { key: scoped },
        data: { status: 'completed', response: response as object },
      }).catch(() => undefined);
      return response;
    }

    const expiresInSeconds = Math.max(
      30,
      Math.floor((order.reservationExpiresAt.getTime() - Date.now()) / 1000),
    );

    let remote;
    try {
      remote = await this.provider.createIntent({
        orderId: order.id,
        publicId: order.publicId,
        method: dto.method,
        amount: Number(order.total),
        payerEmail: order.user?.email,
        cardToken: dto.cardToken,
        installments: dto.installments,
        paymentMethodId: dto.paymentMethodId,
        expiresInSeconds,
        providerIdempotencyKey: `sch-${payment.id}`,
      });
    } catch (e: any) {
      // Falha remota: encerra pending local para não prender unique parcial (#12)
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'cancelled', payload: { error: String(e?.message || e) } as object },
      }).catch(() => undefined);
      await this.audit.log('payment.intent_failed', {
        actorId: userId,
        entity: 'Payment',
        entityId: payment.id,
        meta: { orderId: order.id, error: String(e?.message || e) },
      });
      throw new BadRequestException({
        message: 'Falha ao criar intenção no provedor',
        code: 'PROVIDER_INTENT_FAILED',
      });
    }

    try {
      payment = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          externalId: remote.externalId,
          payload: remote.payload as object,
          status: remote.status === 'approved' ? 'pending' : (remote.status === 'refused' ? 'refused' : 'pending'),
          // approved imediato (ex.: card) ainda passa pelo caminho de apply via applyProviderStatus
        },
      });
    } catch (e) {
      // MP ok + persistência falhou → cancelIntent best-effort (#12)
      await this.provider.cancelIntent(remote.externalId).catch(() => undefined);
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'cancelled' },
      }).catch(() => undefined);
      throw e;
    }

    // Se o provedor já aprovou na criação (cartão), aplica domínio.
    if (remote.status === 'approved') {
      await this.applyProviderStatus(payment.id, {
        status: 'approved',
        amount: Number(order.total),
        externalReference: order.publicId,
        externalId: remote.externalId,
      });
      payment = await this.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    } else if (remote.status === 'refused') {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'refused' },
      });
      payment = await this.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    }

    const response = {
      payment: this.serializePayment(payment),
      orderId: order.id,
      publicId: order.publicId,
      bricksPublicKey: process.env.MERCADO_PAGO_PUBLIC_KEY || process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY || null,
    };

    await this.prisma.idempotencyRecord.update({
      where: { key: scoped },
      data: { status: 'completed', requestHash, response: response as object },
    }).catch(() => undefined);

    await this.audit.log('payment.intent_created', {
      actorId: userId,
      entity: 'Payment',
      entityId: payment.id,
      meta: { orderId: order.id, method: dto.method, provider: this.provider.name },
    });

    return response;
  }

  async getPayment(userId: string, paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });
    if (!payment) throw new NotFoundException({ message: 'Pagamento não encontrado', code: 'PAYMENT_NOT_FOUND' });
    if (payment.order.userId !== userId) {
      throw new ForbiddenException({ message: 'Pagamento de outro usuário', code: 'PAYMENT_FORBIDDEN' });
    }
    return {
      payment: this.serializePayment(payment),
      orderStatus: payment.order.status,
      publicId: payment.order.publicId,
    };
  }

  async getByOrder(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { payments: { orderBy: { createdAt: 'desc' } } },
    });
    if (!order) throw new NotFoundException({ message: 'Pedido não encontrado', code: 'ORDER_NOT_FOUND' });
    return {
      orderId: order.id,
      publicId: order.publicId,
      orderStatus: order.status,
      payments: order.payments.map((p) => this.serializePayment(p)),
    };
  }

  /**
   * Webhook: verify → persist event → fetch fora do lock → apply curto (#9/#12).
   * Body ≠ verdade.
   */
  async handleWebhook(headers: Record<string, string | string[] | undefined>, body: unknown) {
    let verified: VerifiedWebhookEvent;
    try {
      verified = await this.provider.verifyWebhook({ headers, body });
    } catch (e: any) {
      const status = e?.status || 401;
      if (status === 400) {
        throw new BadRequestException({ message: e.message || 'Webhook inválido', code: e.code || 'WEBHOOK_BAD_REQUEST' });
      }
      throw new UnauthorizedException({
        message: e.message || 'Assinatura inválida',
        code: e.code || 'WEBHOOK_SIGNATURE_INVALID',
      });
    }

    // Persistir evento (idempotente por provider+providerEventId)
    let event;
    try {
      event = await this.prisma.paymentEvent.create({
        data: {
          id: randomUUID(),
          provider: this.provider.name === 'null' ? 'null' : 'mercadopago',
          providerEventId: verified.providerEventId,
          topic: verified.topic,
          payload: verified.payload as object,
          applied: false,
        },
      });
    } catch (e) {
      if (this.isUniqueViolation(e)) {
        const existing = await this.prisma.paymentEvent.findUnique({
          where: {
            provider_providerEventId: {
              provider: this.provider.name === 'null' ? 'null' : 'mercadopago',
              providerEventId: verified.providerEventId,
            },
          },
        });
        if (existing?.applied) {
          await this.audit.log('payment.webhook_ignored_duplicate', {
            entity: 'PaymentEvent',
            entityId: existing.id,
          });
          return { ok: true, duplicate: true, applied: true };
        }
        event = existing!;
      } else {
        throw e;
      }
    }

    await this.audit.log('payment.webhook_received', {
      entity: 'PaymentEvent',
      entityId: event.id,
      meta: { topic: verified.topic, externalId: verified.externalId },
    });

    if (!verified.externalId) {
      // Notificação sem payment id — persistida, sem transição
      await this.prisma.paymentEvent.update({
        where: { id: event.id },
        data: { applied: true },
      }).catch(() => undefined);
      return { ok: true, applied: false, reason: 'no_external_id' };
    }

    // Reconsulta fora do lock
    let fetched;
    try {
      fetched = await this.provider.fetchPayment(verified.externalId);
    } catch (e) {
      this.log.error(`fetchPayment falhou para ${verified.externalId}`);
      throw e; // 5xx → retry do provedor
    }

    const local = await this.prisma.payment.findFirst({
      where: { externalId: verified.externalId },
      include: { order: true },
    });

    if (!local) {
      // Órfão autenticado → 2xx sem paid (#9)
      await this.prisma.paymentEvent.update({
        where: { id: event.id },
        data: { applied: true },
      });
      await this.audit.log('payment.orphan_event', {
        entity: 'PaymentEvent',
        entityId: event.id,
        meta: { externalId: verified.externalId, status: fetched.status },
      });
      return { ok: true, applied: false, reason: 'orphan' };
    }

    await this.prisma.paymentEvent.update({
      where: { id: event.id },
      data: { paymentId: local.id },
    }).catch(() => undefined);

    await this.applyProviderStatus(local.id, {
      status: fetched.status,
      amount: fetched.amount,
      externalReference: fetched.externalReference,
      externalId: fetched.externalId,
      payload: fetched.payload,
    });

    await this.prisma.paymentEvent.update({
      where: { id: event.id },
      data: { applied: true },
    });

    return { ok: true, applied: true, paymentId: local.id, status: fetched.status };
  }

  /**
   * Aplica status do provedor em tx curta com CAS de Order.
   */
  async applyProviderStatus(
    paymentId: string,
    info: {
      status: DomainPaymentStatus;
      amount: number;
      externalReference?: string;
      externalId: string;
      payload?: Record<string, unknown>;
    },
  ) {
    if (info.status === 'unknown') {
      await this.audit.log('payment.unmapped_status', {
        entity: 'Payment',
        entityId: paymentId,
        meta: { externalId: info.externalId },
      });
      return { applied: false, reason: 'unmapped' };
    }

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });
    if (!payment) return { applied: false, reason: 'missing' };

    // Já terminal compatível → no-op
    if (payment.status === 'approved' && info.status === 'approved') {
      return { applied: false, reason: 'already_approved' };
    }
    if (payment.status === 'refunded' && info.status === 'refunded') {
      return { applied: false, reason: 'already_refunded' };
    }
    if (['refused', 'expired', 'cancelled'].includes(payment.status) && info.status === payment.status) {
      return { applied: false, reason: 'already_terminal' };
    }

    if (info.status === 'approved') {
      // Amount deve bater com Order.total
      if (Number(info.amount) !== Number(payment.order.total) && Number(info.amount) !== Number(payment.amount)) {
        // Tolerância: comparar com order.total
        if (Math.abs(Number(info.amount) - Number(payment.order.total)) > 0.009) {
          await this.audit.log('payment.amount_mismatch', {
            entity: 'Payment',
            entityId: paymentId,
            meta: { expected: Number(payment.order.total), got: Number(info.amount) },
          });
          return { applied: false, reason: 'amount_mismatch' };
        }
      }
      if (info.externalReference && info.externalReference !== payment.order.publicId) {
        await this.audit.log('payment.reference_mismatch', {
          entity: 'Payment',
          entityId: paymentId,
          meta: { expected: payment.order.publicId, got: info.externalReference },
        });
        return { applied: false, reason: 'reference_mismatch' };
      }

      if (payment.order.status === 'cancelled') {
        await this.prisma.payment.update({
          where: { id: paymentId },
          data: {
            status: 'approved',
            payload: { ...(payment.payload as object || {}), orphanApprovedAfterCancel: true } as object,
          },
        });
        await this.audit.log('payment.orphan_approved_after_cancel', {
          entity: 'Payment',
          entityId: paymentId,
          meta: { orderId: payment.orderId },
        });
        // Compensação best-effort
        await this.provider.refund(info.externalId).catch(() => undefined);
        return { applied: false, reason: 'orphan_after_cancel' };
      }

      if (payment.order.status !== 'awaiting_payment' && payment.order.status !== 'paid') {
        return { applied: false, reason: 'order_not_awaiting' };
      }

      // Marca payment approved + tenta paid via CAS (sem throw se perder a corrida)
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'approved',
          externalId: info.externalId,
          payload: (info.payload || payment.payload || undefined) as object | undefined,
        },
      });

      const won = await this.orders.transitionFromAwaiting(payment.orderId, 'paid');
      if (won) {
        await this.audit.log('order.paid', { entity: 'Order', entityId: payment.orderId });
        await this.audit.log('payment.approved', {
          entity: 'Payment',
          entityId: paymentId,
          meta: { orderId: payment.orderId, transitioned: true },
        });
        await this.loyalty.creditEarnOnPaid(payment.orderId).catch((e: any) => {
          this.log.warn(`cashback earn falhou para ${payment.orderId}: ${e?.message || e}`);
        });
        await this.notifyCustomerPaid(payment.orderId);
        return { applied: true, reason: 'approved' };
      }

      const current = await this.prisma.order.findUnique({ where: { id: payment.orderId } });
      if (current?.status === 'paid') {
        await this.audit.log('payment.approved', {
          entity: 'Payment',
          entityId: paymentId,
          meta: { orderId: payment.orderId, transitioned: false, alreadyPaid: true },
        });
        return { applied: true, reason: 'already_paid' };
      }
      if (current?.status === 'cancelled') {
        await this.prisma.payment.update({
          where: { id: paymentId },
          data: {
            payload: {
              ...((payment.payload as object) || {}),
              orphanApprovedAfterCancel: true,
            } as object,
          },
        });
        await this.audit.log('payment.orphan_approved_after_cancel', {
          entity: 'Payment',
          entityId: paymentId,
          meta: { orderId: payment.orderId },
        });
        await this.provider.refund(info.externalId).catch(() => undefined);
        return { applied: false, reason: 'orphan_after_cancel' };
      }
      return { applied: true, reason: 'approved_payment_only' };
    }

    if (info.status === 'refused' || info.status === 'expired' || info.status === 'cancelled') {
      if (payment.status !== 'pending') {
        return { applied: false, reason: 'not_pending' };
      }
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: { status: info.status },
      });
      await this.audit.log(`payment.${info.status}`, {
        entity: 'Payment',
        entityId: paymentId,
        meta: { orderId: payment.orderId },
      });
      // Recusa/expire/cancel NÃO cancela Order (#6/#7)
      return { applied: true, reason: info.status };
    }

    if (info.status === 'refunded') {
      // Só via admin refund normalmente; webhook de refund confirma
      if (payment.status === 'refunded') return { applied: false, reason: 'already_refunded' };
      if (payment.status !== 'approved') {
        return { applied: false, reason: 'not_approved' };
      }
      await this.finalizeRefundLocal(paymentId);
      return { applied: true, reason: 'refunded' };
    }

    if (info.status === 'pending') {
      return { applied: false, reason: 'still_pending' };
    }

    return { applied: false, reason: 'noop' };
  }

  async adminRefund(adminId: string, paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: { include: { items: true } } },
    });
    if (!payment) throw new NotFoundException({ message: 'Pagamento não encontrado', code: 'PAYMENT_NOT_FOUND' });

    if (payment.status === 'refunded') {
      return { payment: this.serializePayment(payment), idempotent: true };
    }
    if (payment.status !== 'approved') {
      throw new BadRequestException({
        message: 'Somente pagamento approved pode ser estornado',
        code: 'PAYMENT_NOT_APPROVED',
      });
    }
    if (!isRefundAllowed(payment.order.status)) {
      throw new BadRequestException({
        message: 'Pedido não permite estorno neste estado',
        code: 'ORDER_REFUND_NOT_ALLOWED',
      });
    }
    if (!payment.externalId) {
      throw new BadRequestException({ message: 'Pagamento sem externalId', code: 'PAYMENT_NO_EXTERNAL_ID' });
    }

    // I/O remoto fora do lock (#10/#12)
    const remote = await this.provider.refund(payment.externalId);
    if (remote.status !== 'refunded') {
      // Reconsulta
      const fetched = await this.provider.fetchPayment(payment.externalId);
      if (fetched.status !== 'refunded') {
        throw new BadRequestException({
          message: 'Provedor não confirmou estorno',
          code: 'PROVIDER_REFUND_PENDING',
        });
      }
    }

    await this.finalizeRefundLocal(paymentId, adminId);
    const updated = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    return { payment: this.serializePayment(updated), idempotent: false };
  }

  private async finalizeRefundLocal(paymentId: string, actorId?: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: { include: { items: true } } },
    });
    if (!payment) return;
    if (payment.status === 'refunded') return;

    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$executeRaw`
        UPDATE "Payment"
        SET "status" = 'refunded'::"PaymentStatus"
        WHERE "id" = ${paymentId}
          AND "status" = 'approved'::"PaymentStatus"
      `;
      if (rows === 0) return;

      const order = payment.order;
      const fromStatus = order.status;
      if (!isRefundAllowed(fromStatus)) return;

      const oRows = await tx.$executeRaw`
        UPDATE "Order"
        SET "status" = 'refunded'::"OrderStatus"
        WHERE "id" = ${order.id}
          AND "status" = ${fromStatus}::"OrderStatus"
      `;
      if (oRows === 0) return;

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus,
          toStatus: 'refunded',
          actorId: actorId || null,
          note: 'payment_refunded',
        },
      });

      if (shouldRestockOnRefund(fromStatus)) {
        for (const item of order.items) {
          await this.inventory.restock(tx, item.productId, item.qty);
        }
      }
    });

    await this.audit.log('order.refunded', {
      actorId,
      entity: 'Order',
      entityId: payment.orderId,
      meta: { paymentId },
    });
  }

  /**
   * Chamado pelo caminho de expiração de reserva: marca pending → expired (local).
   * Retorna externalIds para cancelIntent best-effort fora do lock.
   */
  async expirePendingForOrder(orderId: string): Promise<string[]> {
    const pendings = await this.prisma.payment.findMany({
      where: { orderId, status: 'pending' },
      select: { id: true, externalId: true },
    });
    const externalIds: string[] = [];
    for (const p of pendings) {
      await this.prisma.payment.update({
        where: { id: p.id },
        data: { status: 'expired' },
      });
      if (p.externalId) externalIds.push(p.externalId);
      await this.audit.log('payment.expired', { entity: 'Payment', entityId: p.id, meta: { orderId } });
    }
    return externalIds;
  }

  async cancelRemoteBestEffort(externalIds: string[]) {
    for (const id of externalIds) {
      try {
        await this.provider.cancelIntent(id);
      } catch (e) {
        this.log.warn(`cancelIntent best-effort falhou: ${id}`);
      }
    }
  }
  /** Best-effort: e-mail + notificação in-app "Pedido pago" (cliente + admins). Nunca lança. */
  private async notifyCustomerPaid(orderId: string) {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { user: { select: { email: true, name: true } } },
      });
      if (!order) {
        this.log.warn(`Pedido pago não encontrado: ${orderId}`);
        return;
      }
      if (order.userId) {
        await this.notifications.createSafe({
          userId: order.userId,
          type: 'order_paid',
          title: 'Pedido pago',
          body: `Recebemos o pagamento do pedido ${order.publicId}.`,
          linkUrl: `/pedidos/${order.publicId}`,
          orderId: order.id,
        });
      }
      const adminPayload = buildAdminOrderPaidNotification({
        publicId: order.publicId,
        total: Number(order.total),
        orderId: order.id,
      });
      await this.notifications.notifyActiveAdmins({
        ...adminPayload,
        // Cliente já notificado acima; se for admin, evita duplicata com copy de cliente.
        excludeUserIds: order.userId ? [order.userId] : [],
      });
      const to = order.user?.email;
      if (!to) {
        this.log.warn(`Pedido pago sem e-mail de cliente: ${orderId}`);
        return;
      }
      await this.mail.notifyOrderPaid(to, {
        publicId: order.publicId,
        total: Number(order.total),
        customerName: order.user?.name,
      });
    } catch (e: any) {
      this.log.error(`notifyCustomerPaid falhou: ${e?.message || e}`);
    }
  }

}
