import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { structuredLog } from '../../common/structured-log';
import type { PaymentProvider } from '../payments/payment.provider';
import { PaymentsService } from '../payments/payments.service';
import { FinancialRecorder } from './financial-recorder.service';
import { financeMetrics } from './finance-metrics';
import { currentPaymentState } from './payment-state-machine';

const ACTIVE_REFUND_STATUSES = ['REQUESTED', 'PROCESSING', 'COMPLETED', 'UNKNOWN'] as const;
const TX_OPTS = { maxWait: 20_000, timeout: 20_000 } as const;

function money(n: unknown) {
  return Math.round(Number(n || 0) * 100) / 100;
}

/** MP refund status → local refund status. */
export function refundStatusFromProvider(status: string): 'COMPLETED' | 'PROCESSING' | 'FAILED' {
  const s = String(status || '').toLowerCase();
  if (s === 'approved') return 'COMPLETED';
  if (s === 'rejected' || s === 'cancelled' || s === 'canceled') return 'FAILED';
  return 'PROCESSING'; // in_process | pending | authorized | unknown
}

/** Pure: how much can still be refunded. */
export function computeRefundable(input: { paid: number; activeRefunds: number; externalRefunds: number }) {
  return money(input.paid - input.activeRefunds - input.externalRefunds);
}

export function refundsEnabled(env: NodeJS.ProcessEnv = process.env) {
  return String(env.FINANCE_REFUNDS_ENABLED || '').toLowerCase() === 'true';
}

export type RequestRefundInput = {
  paymentId: string;
  amount?: number;
  reason: string;
  idempotencyKey: string;
  actorId: string;
  actorRole?: string;
};

/**
 * Refund engine (total/partial). Guarantees:
 *  - never above the paid amount (row lock on Payment + sum of active refunds + refunds seen at MP)
 *  - idempotent per client key (unique PaymentRefund.idempotencyKey) and per MP refund id
 *  - provider call outside the lock with X-Idempotency-Key = sch-refund-<refundId> (safe retry)
 *  - timeouts/5xx ⇒ UNKNOWN (retried with the SAME key), never assumed success
 * Guarded by FINANCE_REFUNDS_ENABLED=true (off by default).
 */
@Injectable()
export class RefundsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject('PaymentProvider') private readonly provider: PaymentProvider,
    @Inject(PaymentsService) private readonly payments: PaymentsService,
    @Inject(FinancialRecorder) private readonly recorder: FinancialRecorder,
  ) {}

  async requestRefund(input: RequestRefundInput) {
    if (!refundsEnabled()) {
      throw new ServiceUnavailableException({
        message: 'Estornos pelo módulo Financeiro estão desativados (FINANCE_REFUNDS_ENABLED).',
        code: 'FINANCE_REFUNDS_DISABLED',
      });
    }
    const reason = String(input.reason || '').trim();
    if (reason.length < 10) throw new BadRequestException({ message: 'Motivo obrigatório (mín. 10 caracteres)', code: 'REASON_REQUIRED' });
    const key = String(input.idempotencyKey || '').trim();
    if (key.length < 8 || key.length > 120) throw new BadRequestException({ message: 'Idempotency-Key obrigatória', code: 'IDEMPOTENCY_KEY_REQUIRED' });
    if (input.amount != null) {
      if (!Number.isFinite(input.amount) || input.amount <= 0 || Math.round(input.amount * 100) !== input.amount * 100) {
        throw new BadRequestException({ message: 'Valor de estorno inválido', code: 'INVALID_REFUND_AMOUNT' });
      }
    }
    const scopedKey = `refund:${input.paymentId}:${key}`;

    const replay = await this.prisma.paymentRefund.findUnique({ where: { idempotencyKey: scopedKey } });
    if (replay) return this.replayOrConflict(replay, input);

    let refund;
    try {
      refund = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "id" = ${input.paymentId} FOR UPDATE`;
        const p = await tx.payment.findUnique({ where: { id: input.paymentId } });
        if (!p) throw new NotFoundException({ message: 'Pagamento não encontrado', code: 'PAYMENT_NOT_FOUND' });
        const again = await tx.paymentRefund.findUnique({ where: { idempotencyKey: scopedKey } });
        if (again) return again;
        const state = currentPaymentState(p);
        if (p.status !== 'approved' || !['PAID', 'PARTIALLY_REFUNDED', 'CHARGEBACK_WON'].includes(state)) {
          throw new BadRequestException({
            message: `Pagamento não pode ser estornado no estado ${state}`,
            code: 'PAYMENT_NOT_REFUNDABLE',
            state,
          });
        }
        if (!p.externalId) throw new BadRequestException({ message: 'Pagamento sem id do provedor', code: 'PAYMENT_NO_EXTERNAL_ID' });
        const active = await tx.paymentRefund.aggregate({
          where: { paymentId: p.id, status: { in: [...ACTIVE_REFUND_STATUSES] } },
          _sum: { amount: true },
        });
        const external = await tx.financialLedgerEntry.aggregate({
          where: { paymentId: p.id, entryType: 'REFUND_COMPLETED', direction: 'DEBIT', refundId: null },
          _sum: { amount: true },
        });
        const paid = money(p.amount);
        const activeSum = money(active._sum.amount);
        const refundable = computeRefundable({ paid, activeRefunds: activeSum, externalRefunds: money(external._sum.amount) });
        const amount = input.amount != null ? money(input.amount) : refundable;
        if (amount <= 0 || refundable <= 0) {
          throw new ConflictException({ message: 'Nada a estornar neste pagamento', code: 'NOTHING_TO_REFUND', refundable });
        }
        if (amount > refundable + 0.001) {
          throw new ConflictException({ message: `Estorno acima do valor disponível (R$ ${refundable.toFixed(2)})`, code: 'REFUND_EXCEEDS_PAID', refundable });
        }
        const isFull = money(paid - activeSum - money(external._sum.amount) - amount) <= 0.009;
        const row = await tx.paymentRefund.create({
          data: {
            paymentId: p.id,
            orderId: p.orderId,
            amount,
            isFull,
            reason: reason.slice(0, 500),
            requestedBy: input.actorId,
            idempotencyKey: scopedKey,
            provider: p.provider,
            status: 'REQUESTED',
          },
        });
        await this.recorder.appendLedger(tx, {
          entryType: 'REFUND_CREATED',
          direction: 'NONE',
          amount,
          idempotencyKey: `REFUND_CREATED:${row.id}`,
          source: 'admin',
          paymentId: p.id,
          orderId: p.orderId,
          refundId: row.id,
          externalId: p.externalId,
          actorId: input.actorId,
          meta: { isFull, firstRefund: activeSum === 0 },
        });
        await this.recorder.audit(tx, {
          action: 'refund.requested',
          origin: 'admin',
          actorId: input.actorId,
          actorRole: input.actorRole ?? 'admin',
          orderId: p.orderId,
          paymentId: p.id,
          refundId: row.id,
          amount,
          oldState: state,
          reason,
          meta: { isFull, refundableBefore: refundable },
        });
        return row;
      }, TX_OPTS);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const r = await this.prisma.paymentRefund.findUnique({ where: { idempotencyKey: scopedKey } });
        if (r) return this.replayOrConflict(r, input);
      }
      throw e;
    }
    financeMetrics.inc('refunds_requested');
    return this.execute(refund.id);
  }

  private async replayOrConflict(r: { id: string; paymentId: string; amount: Prisma.Decimal; status: string }, input: RequestRefundInput) {
    if (r.paymentId !== input.paymentId || (input.amount != null && money(r.amount) !== money(input.amount))) {
      throw new ConflictException({ message: 'Idempotency-Key já usada com outro estorno', code: 'IDEMPOTENCY_KEY_REUSED' });
    }
    return { refund: await this.serialize(r.id), idempotent: true };
  }

  /** Execute (or safely retry) a refund against the provider. Same X-Idempotency-Key every time. */
  async execute(refundId: string) {
    const claimed = await this.prisma.paymentRefund.updateMany({
      where: { id: refundId, status: { in: ['REQUESTED', 'UNKNOWN'] } },
      data: { status: 'PROCESSING', attempts: { increment: 1 } },
    });
    const refund = await this.prisma.paymentRefund.findUniqueOrThrow({ where: { id: refundId } });
    if (claimed.count === 0) return { refund: await this.serialize(refundId), idempotent: true };
    const payment = await this.prisma.payment.findUniqueOrThrow({ where: { id: refund.paymentId } });

    if (typeof this.provider.createRefund !== 'function') {
      await this.markFailed(refund, payment, 'provider_without_refund_api');
      return { refund: await this.serialize(refundId), idempotent: false };
    }

    const priorCompleted = await this.prisma.paymentRefund.count({
      where: { paymentId: payment.id, status: { in: ['COMPLETED', 'PROCESSING', 'UNKNOWN'] }, NOT: { id: refund.id } },
    });
    const sendAmount = refund.isFull && priorCompleted === 0 ? undefined : money(refund.amount);
    let res: Awaited<ReturnType<NonNullable<PaymentProvider['createRefund']>>>;
    try {
      res = await this.provider.createRefund(payment.externalId!, {
        amount: sendAmount,
        idempotencyKey: `sch-refund-${refund.id}`,
        accessToken: await this.payments.collectorAccessTokenForPayment(payment),
      });
    } catch (e: any) {
      financeMetrics.inc('provider_errors');
      const status = Number(e?.status || 0);
      const msg = String(e?.message || e).slice(0, 300);
      if (status >= 400 && status < 500) {
        await this.markFailed(refund, payment, `provider_${status}:${msg}`);
      } else {
        await this.markUnknown(refund, payment, `provider_${status || 'network'}:${msg}`);
      }
      return { refund: await this.serialize(refundId), idempotent: false };
    }

    const local = refundStatusFromProvider(res.status);
    if (local === 'FAILED') {
      await this.markFailed(refund, payment, `provider_status:${res.status}`, res.refundId);
    } else if (local === 'PROCESSING') {
      await this.prisma.paymentRefund.update({
        where: { id: refund.id },
        data: { providerRefundId: res.refundId || null, providerStatus: res.status, lastError: null },
      });
    } else {
      await this.markCompleted(refund, payment, res.refundId, res.status);
    }
    return { refund: await this.serialize(refundId), idempotent: false };
  }

  private async markCompleted(
    refund: { id: string; paymentId: string; orderId: string; amount: Prisma.Decimal; isFull: boolean; requestedBy: string | null },
    payment: { id: string; externalId: string | null; amount: Prisma.Decimal },
    providerRefundId: string,
    providerStatus: string,
  ) {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.paymentRefund.update({
          where: { id: refund.id },
          data: { status: 'COMPLETED', providerRefundId: providerRefundId || null, providerStatus, completedAt: new Date(), lastError: null },
        });
        await this.recorder.appendLedger(tx, {
          entryType: 'REFUND_COMPLETED',
          direction: 'DEBIT',
          amount: money(refund.amount),
          idempotencyKey: `REFUND_COMPLETED:${refund.id}`,
          source: 'refund',
          paymentId: refund.paymentId,
          orderId: refund.orderId,
          refundId: refund.id,
          externalId: payment.externalId,
          actorId: refund.requestedBy,
          meta: { providerRefundId },
        });
        await this.recorder.audit(tx, {
          action: 'refund.completed',
          origin: 'refund',
          actorId: refund.requestedBy,
          orderId: refund.orderId,
          paymentId: refund.paymentId,
          refundId: refund.id,
          amount: money(refund.amount),
          meta: { providerRefundId, providerStatus },
        });
      }, TX_OPTS);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        // Same MP refund id already bound to another local refund: MP deduplicated → do not double count.
        await this.prisma.paymentRefund.update({
          where: { id: refund.id },
          data: { status: 'FAILED', providerStatus, lastError: `duplicate_provider_refund:${providerRefundId}` },
        });
        await this.recorder.openDiscrepancy(this.prisma, {
          type: 'DUPLICATE_PROVIDER_REFUND',
          severity: 'CRITICAL',
          dedupeKey: `DUPLICATE_PROVIDER_REFUND:${refund.id}`,
          message: `Refund MP ${providerRefundId} já vinculado a outro estorno local`,
          orderId: refund.orderId,
          paymentId: refund.paymentId,
          externalId: payment.externalId,
        });
        return;
      }
      throw e;
    }
    financeMetrics.inc('refunds_completed');
    structuredLog('info', 'REFUND_COMPLETED', { refundId: refund.id, paymentId: refund.paymentId, orderId: refund.orderId });

    const completedSum = await this.prisma.paymentRefund.aggregate({
      where: { paymentId: refund.paymentId, status: 'COMPLETED' },
      _sum: { amount: true },
    });
    const external = await this.prisma.financialLedgerEntry.aggregate({
      where: { paymentId: refund.paymentId, entryType: 'REFUND_COMPLETED', direction: 'DEBIT', refundId: null },
      _sum: { amount: true },
    });
    const totalRefunded = money(money(completedSum._sum.amount) + money(external._sum.amount));
    if (totalRefunded + 0.009 >= money(payment.amount)) {
      // Total: reuse the existing local finalization (payment+order refunded, restock, commission reverse).
      await this.payments.finalizeRefundLocal(refund.paymentId, refund.requestedBy || undefined);
    } else {
      await this.recorder.syncPaymentState(refund.paymentId, {
        source: 'refund',
        actorId: refund.requestedBy,
        reason: 'partial_refund_completed',
        obs: { rawStatus: 'approved', refundedAmount: totalRefunded },
      });
    }
    await this.resolveStuck(refund.id);
  }

  private async markFailed(
    refund: { id: string; paymentId: string; orderId: string; amount: Prisma.Decimal; requestedBy: string | null },
    payment: { externalId: string | null },
    error: string,
    providerRefundId?: string,
  ) {
    await this.prisma.paymentRefund.update({
      where: { id: refund.id },
      data: { status: 'FAILED', lastError: error.slice(0, 500), ...(providerRefundId ? { providerStatus: 'rejected' } : {}) },
    });
    await this.recorder.appendLedger(this.prisma, {
      entryType: 'REFUND_FAILED',
      direction: 'NONE',
      amount: money(refund.amount),
      idempotencyKey: `REFUND_FAILED:${refund.id}`,
      source: 'refund',
      paymentId: refund.paymentId,
      orderId: refund.orderId,
      refundId: refund.id,
      externalId: payment.externalId,
      actorId: refund.requestedBy,
    });
    await this.recorder.auditSafe({
      action: 'refund.failed',
      origin: 'refund',
      actorId: refund.requestedBy,
      orderId: refund.orderId,
      paymentId: refund.paymentId,
      refundId: refund.id,
      amount: money(refund.amount),
      reason: error.slice(0, 300),
    });
    await this.recorder.openDiscrepancy(this.prisma, {
      type: 'REFUND_FAILED',
      severity: 'MEDIUM',
      dedupeKey: `REFUND_FAILED:${refund.id}`,
      message: `Estorno recusado/falhou no provedor: ${error.slice(0, 200)}`,
      orderId: refund.orderId,
      paymentId: refund.paymentId,
      externalId: payment.externalId,
    });
    await this.resolveStuck(refund.id);
    financeMetrics.inc('refunds_failed');
  }

  private async markUnknown(
    refund: { id: string; paymentId: string; orderId: string; amount: Prisma.Decimal },
    payment: { externalId: string | null },
    error: string,
  ) {
    await this.prisma.paymentRefund.update({ where: { id: refund.id }, data: { status: 'UNKNOWN', lastError: error.slice(0, 500) } });
    await this.recorder.openDiscrepancy(this.prisma, {
      type: 'REFUND_STUCK',
      severity: 'HIGH',
      dedupeKey: `REFUND_STUCK:${refund.id}`,
      message: `Estorno sem confirmação do provedor (${error.slice(0, 150)}). Reprocessar com a mesma chave é seguro.`,
      orderId: refund.orderId,
      paymentId: refund.paymentId,
      externalId: payment.externalId,
    });
    structuredLog('error', 'REFUND_UNKNOWN', { refundId: refund.id, paymentId: refund.paymentId });
  }

  private async resolveStuck(refundId: string) {
    await this.prisma.financialDiscrepancy.updateMany({
      where: { dedupeKey: `REFUND_STUCK:${refundId}`, status: { not: 'RESOLVED' } },
      data: { conditionCleared: true },
    });
  }

  /** Retry UNKNOWN (or stale REQUESTED/PROCESSING) refunds with the same idempotency key. */
  async retry(refundId: string, actorId: string, reason: string) {
    if (!refundsEnabled()) {
      throw new ServiceUnavailableException({ message: 'Estornos desativados (FINANCE_REFUNDS_ENABLED).', code: 'FINANCE_REFUNDS_DISABLED' });
    }
    const r = await this.prisma.paymentRefund.findUnique({ where: { id: refundId } });
    if (!r) throw new NotFoundException({ message: 'Estorno não encontrado', code: 'REFUND_NOT_FOUND' });
    const stale = Date.now() - r.updatedAt.getTime() > 2 * 60_000;
    if (r.status === 'PROCESSING' && stale) {
      await this.prisma.paymentRefund.update({ where: { id: r.id }, data: { status: 'UNKNOWN' } });
    } else if (r.status !== 'UNKNOWN' && !(r.status === 'REQUESTED' && stale)) {
      throw new BadRequestException({ message: `Estorno em ${r.status} não pode ser reprocessado agora`, code: 'REFUND_NOT_RETRYABLE' });
    }
    await this.recorder.auditSafe({ action: 'refund.retry', origin: 'admin', actorId, orderId: r.orderId, paymentId: r.paymentId, refundId: r.id, amount: money(r.amount), reason });
    return this.execute(r.id);
  }

  /** PROCESSING refund with a provider id: re-read GET /v1/payments/{id}/refunds and settle it. */
  async refreshFromProvider(refundId: string): Promise<string> {
    const r = await this.prisma.paymentRefund.findUnique({ where: { id: refundId } });
    if (!r || r.status !== 'PROCESSING' || !r.providerRefundId) return r?.status ?? 'MISSING';
    if (typeof this.provider.listRefunds !== 'function') return r.status;
    const payment = await this.prisma.payment.findUniqueOrThrow({ where: { id: r.paymentId } });
    const list = await this.provider.listRefunds(payment.externalId!, {
      accessToken: await this.payments.collectorAccessTokenForPayment(payment),
    });
    const hit = list.find((x) => x.refundId === r.providerRefundId);
    if (!hit) return r.status;
    const local = refundStatusFromProvider(hit.status);
    if (local === 'COMPLETED') await this.markCompleted(r, payment, hit.refundId, hit.status);
    else if (local === 'FAILED') await this.markFailed(r, payment, `provider_status:${hit.status}`, hit.refundId);
    return local;
  }

  async serialize(refundId: string) {
    const r = await this.prisma.paymentRefund.findUniqueOrThrow({ where: { id: refundId } });
    return {
      id: r.id,
      paymentId: r.paymentId,
      orderId: r.orderId,
      amount: money(r.amount),
      status: r.status,
      isFull: r.isFull,
      reason: r.reason,
      providerRefundId: r.providerRefundId,
      providerStatus: r.providerStatus,
      lastError: r.lastError,
      attempts: r.attempts,
      createdAt: r.createdAt,
      completedAt: r.completedAt,
    };
  }
}
