import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { AuditService } from '../../common/audit.service';
import { OrdersService } from '../orders/orders.service';
import { FinancialRecorder } from './financial-recorder.service';
import { financeMetrics } from './finance-metrics';
import { FinanceMetricsStore } from './finance-metrics.store';
import { currentPaymentState, PAYMENT_STATE_LABEL_PT } from './payment-state-machine';
import { refundsEnabled } from './refunds.service';
import { reconciliationCronEnabled } from './reconciliation.scheduler';

const money = (n: unknown) => Math.round(Number(n || 0) * 100) / 100;
const clampLimit = (v: unknown, def = 50, max = 200) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), max) : def;
};

/** Start of "today" in America/Sao_Paulo (UTC-3, no DST since 2019). */
export function startOfTodaySaoPaulo(now = new Date()): Date {
  const shifted = new Date(now.getTime() - 3 * 3600_000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate(), 3, 0, 0));
}

@Injectable()
export class FinanceAdminService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditLog: AuditService,
    @Inject(OrdersService) private readonly orders: OrdersService,
    @Inject(FinancialRecorder) private readonly recorder: FinancialRecorder,
    @Inject(FinanceMetricsStore) private readonly metricsStore: FinanceMetricsStore,
  ) {}

  /** Admin-only financial health: DB-derived durable counts + persistent counters + in-process counters. */
  async health() {
    const since24h = new Date(Date.now() - 86_400_000);
    const [byStatus, webhook24h, webhookFailed24h, dupAttempts, openDisc, openCb, refundsOpen, lastRun, orphanQueue, persisted] = await Promise.all([
      this.prisma.payment.groupBy({ by: ['status'], where: { updatedAt: { gte: since24h } }, _count: { _all: true } }),
      this.prisma.paymentEvent.count({ where: { createdAt: { gte: since24h } } }),
      this.prisma.paymentEvent.count({ where: { createdAt: { gte: since24h }, processingStatus: 'FAILED' } }),
      this.prisma.paymentEvent.aggregate({ where: { createdAt: { gte: since24h }, attempts: { gt: 1 } }, _sum: { attempts: true }, _count: { _all: true } }),
      this.prisma.financialDiscrepancy.groupBy({ by: ['severity'], where: { status: { not: 'RESOLVED' } }, _count: { _all: true } }),
      this.prisma.chargeback.count({ where: { status: { in: ['OPENED', 'IN_REVIEW', 'UNKNOWN'] } } }),
      this.prisma.paymentRefund.count({ where: { status: { in: ['REQUESTED', 'PROCESSING', 'UNKNOWN'] } } }),
      this.prisma.financialReconciliationRun.findFirst({ where: { status: { in: ['COMPLETED', 'FAILED'] } }, orderBy: { startedAt: 'desc' } }),
      this.prisma.paymentReconciliation.count({ where: { status: 'RECONCILIATION_REQUIRED', resolvedAt: null } }),
      this.metricsStore.persisted(),
    ]);
    const disc: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    for (const d of openDisc) disc[d.severity] = d._count._all;
    const status = disc.CRITICAL > 0 || webhookFailed24h > 0 ? 'ATTENTION' : disc.HIGH > 0 || refundsOpen > 0 ? 'WARN' : 'OK';
    return {
      status,
      generatedAt: new Date().toISOString(),
      db: {
        paymentsUpdatedLast24hByStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
        webhooksLast24h: webhook24h,
        webhookFailuresLast24h: webhookFailed24h,
        webhookEventsWithDuplicatesLast24h: dupAttempts._count._all,
        openDiscrepancies: disc,
        openChargebacks: openCb,
        refundsInFlight: refundsOpen,
        orphanPaymentQueue: orphanQueue,
        lastReconciliation: lastRun ? { id: lastRun.id, scope: lastRun.scope, status: lastRun.status, startedAt: lastRun.startedAt, finishedAt: lastRun.finishedAt } : null,
      },
      process: financeMetrics.snapshot(),
      /** Durable counters (survive restarts, summed across replicas). */
      persisted,
      flags: {
        refundsEnabled: refundsEnabled(),
        reconciliationCronEnabled: reconciliationCronEnabled(),
        provider: process.env.PAYMENTS_PROVIDER || 'mercadopago',
      },
    };
  }

  async dashboard() {
    const today = startOfTodaySaoPaulo();
    const sumLedger = async (entryType: string, since?: Date, excludeBackfill = true) => {
      const r = await this.prisma.financialLedgerEntry.aggregate({
        where: { entryType, ...(since ? { createdAt: { gte: since } } : {}), ...(excludeBackfill ? { source: { not: 'reconciliation_backfill' } } : {}) },
        _sum: { amount: true },
        _count: { _all: true },
      });
      return { amount: money(r._sum.amount), count: r._count._all };
    };
    const [receivedToday, refundedToday, pending, underReview, refundedTotal, cbOpen, cbLost, disc, lastRun] = await Promise.all([
      sumLedger('PAYMENT_CAPTURED', today),
      sumLedger('REFUND_COMPLETED', today),
      this.prisma.payment.aggregate({ where: { status: 'pending' }, _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.payment.aggregate({ where: { reviewStatus: 'UNDER_REVIEW' }, _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.payment.aggregate({ where: { status: 'refunded' }, _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.chargeback.aggregate({ where: { status: { in: ['OPENED', 'IN_REVIEW', 'UNKNOWN'] } }, _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.chargeback.aggregate({ where: { status: 'LOST' }, _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.financialDiscrepancy.groupBy({ by: ['severity'], where: { status: { not: 'RESOLVED' } }, _count: { _all: true } }),
      this.prisma.financialReconciliationRun.findFirst({ orderBy: { startedAt: 'desc' } }),
    ]);
    const agg = (a: { _sum: { amount: unknown }; _count: { _all: number } }) => ({ amount: money(a._sum.amount), count: a._count._all });
    const discrepancies: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    for (const d of disc) discrepancies[d.severity] = d._count._all;
    return {
      generatedAt: new Date().toISOString(),
      todayStartsAt: today.toISOString(),
      source: 'database',
      notes: [
        'Recebido hoje = lançamentos PAYMENT_CAPTURED do ledger desde 00:00 (horário de Brasília); o ledger passou a existir com esta versão — antes disso não há histórico no ledger.',
      ],
      receivedToday,
      refundedToday,
      pending: agg(pending),
      underReview: agg(underReview),
      refundedTotal: agg(refundedTotal),
      chargebacksOpen: agg(cbOpen),
      chargebacksLost: agg(cbLost),
      discrepancies,
      lastReconciliation: lastRun ? { id: lastRun.id, scope: lastRun.scope, status: lastRun.status, startedAt: lastRun.startedAt, stats: lastRun.stats } : null,
    };
  }

  async listPayments(q: { status?: string; state?: string; method?: string; review?: string; from?: string; to?: string; q?: string; limit?: string; cursor?: string }) {
    const where: Prisma.PaymentWhereInput = {};
    if (q.status) where.status = q.status as any;
    if (q.state) where.financialState = q.state;
    if (q.method === 'pix' || q.method === 'card') where.method = q.method;
    if (q.review) where.reviewStatus = q.review;
    if (q.from || q.to) where.createdAt = { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) };
    if (q.q) {
      const s = q.q.trim().slice(0, 80);
      where.OR = [{ externalId: s }, { id: s.length === 36 ? s : undefined }, { order: { publicId: { contains: s, mode: 'insensitive' } } }].filter((x: any) => Object.values(x)[0] !== undefined) as any;
    }
    const take = clampLimit(q.limit);
    const rows = await this.prisma.payment.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      select: {
        id: true, orderId: true, provider: true, method: true, status: true, financialState: true, reviewStatus: true,
        externalId: true, amount: true, createdAt: true, updatedAt: true,
        order: { select: { publicId: true, status: true, total: true } },
      },
    });
    const items = rows.slice(0, take).map((p) => {
      const state = currentPaymentState(p);
      return { ...p, amount: money(p.amount), order: { ...p.order, total: money(p.order.total) }, state, stateLabel: PAYMENT_STATE_LABEL_PT[state] };
    });
    return { items, nextCursor: rows.length > take ? rows[take - 1].id : null };
  }

  async paymentDetail(id: string) {
    const p = await this.prisma.payment.findUnique({
      where: { id },
      select: {
        id: true, orderId: true, provider: true, method: true, status: true, financialState: true, financialStateAt: true, reviewStatus: true,
        externalId: true, amount: true, splitMode: true, createdAt: true, updatedAt: true,
        order: { select: { id: true, publicId: true, status: true, total: true, reservationExpiresAt: true, createdAt: true } },
      },
    });
    if (!p) throw new NotFoundException({ message: 'Pagamento não encontrado', code: 'PAYMENT_NOT_FOUND' });
    const [transitions, ledger, refunds, chargebacks, discrepancies, risk, events, audit] = await Promise.all([
      this.prisma.paymentStateTransition.findMany({ where: { paymentId: id }, orderBy: { createdAt: 'asc' } }),
      this.prisma.financialLedgerEntry.findMany({ where: { paymentId: id }, orderBy: { createdAt: 'asc' } }),
      this.prisma.paymentRefund.findMany({ where: { paymentId: id }, orderBy: { createdAt: 'asc' } }),
      this.prisma.chargeback.findMany({ where: { paymentId: id } }),
      this.prisma.financialDiscrepancy.findMany({ where: { paymentId: id }, orderBy: { lastSeenAt: 'desc' } }),
      this.prisma.riskAssessment.findMany({ where: { paymentId: id }, orderBy: { createdAt: 'desc' }, take: 10 }),
      this.prisma.paymentEvent.findMany({
        where: { paymentId: id },
        orderBy: { createdAt: 'asc' },
        select: { id: true, providerEventId: true, topic: true, action: true, processingStatus: true, attempts: true, lastError: true, createdAt: true, processedAt: true },
      }),
      this.prisma.financialAuditEvent.findMany({ where: { paymentId: id }, orderBy: { createdAt: 'asc' }, take: 200 }),
    ]);
    const state = currentPaymentState(p);
    return {
      payment: { ...p, amount: money(p.amount), order: { ...p.order, total: money(p.order.total) }, state, stateLabel: PAYMENT_STATE_LABEL_PT[state] },
      transitions,
      ledger: ledger.map((l) => ({ ...l, amount: money(l.amount) })),
      refunds: refunds.map((r) => ({ ...r, amount: money(r.amount) })),
      chargebacks,
      discrepancies,
      risk,
      webhookEvents: events,
      audit,
    };
  }

  async listDiscrepancies(q: { status?: string; severity?: string; type?: string; limit?: string }) {
    const where: Prisma.FinancialDiscrepancyWhereInput = {};
    if (q.status === 'open') where.status = { not: 'RESOLVED' };
    else if (q.status) where.status = q.status;
    if (q.severity) where.severity = q.severity;
    if (q.type) where.type = q.type;
    return this.prisma.financialDiscrepancy.findMany({ where, orderBy: [{ lastSeenAt: 'desc' }], take: clampLimit(q.limit, 100, 500) });
  }

  async listChargebacks(q: { status?: string; limit?: string }) {
    const rows = await this.prisma.chargeback.findMany({ where: q.status ? { status: q.status } : {}, orderBy: { createdAt: 'desc' }, take: clampLimit(q.limit) });
    return rows.map((c) => ({ ...c, amount: c.amount == null ? null : money(c.amount) }));
  }

  async listRefunds(q: { status?: string; limit?: string }) {
    const rows = await this.prisma.paymentRefund.findMany({ where: q.status ? { status: q.status } : {}, orderBy: { createdAt: 'desc' }, take: clampLimit(q.limit) });
    return rows.map((r) => ({ ...r, amount: money(r.amount), idempotencyKey: undefined }));
  }

  async listLedger(q: { paymentId?: string; orderId?: string; entryType?: string; limit?: string }) {
    const rows = await this.prisma.financialLedgerEntry.findMany({
      where: { ...(q.paymentId ? { paymentId: q.paymentId } : {}), ...(q.orderId ? { orderId: q.orderId } : {}), ...(q.entryType ? { entryType: q.entryType } : {}) },
      orderBy: { createdAt: 'desc' },
      take: clampLimit(q.limit, 100, 500),
    });
    return rows.map((l) => ({ ...l, amount: money(l.amount) }));
  }

  async listAudit(q: { paymentId?: string; orderId?: string; action?: string; limit?: string }) {
    return this.prisma.financialAuditEvent.findMany({
      where: { ...(q.paymentId ? { paymentId: q.paymentId } : {}), ...(q.orderId ? { orderId: q.orderId } : {}), ...(q.action ? { action: q.action } : {}) },
      orderBy: { createdAt: 'desc' },
      take: clampLimit(q.limit, 100, 500),
    });
  }

  async listRuns(limit?: string) {
    return this.prisma.financialReconciliationRun.findMany({ orderBy: { startedAt: 'desc' }, take: clampLimit(limit, 30, 200) });
  }

  /** Mirrors every controlled action to the legacy AuditLog too (existing admin audit screen). */
  async auditAction(action: string, actorId: string, data: { orderId?: string | null; paymentId?: string | null; refundId?: string | null; amount?: number | null; reason: string; oldState?: string | null; newState?: string | null; meta?: Record<string, unknown> }) {
    await this.recorder.audit(this.prisma, { action, origin: 'admin', actorId, actorRole: 'admin', ...data });
    await this.auditLog.log(`finance.${action}`, { actorId, entity: data.paymentId ? 'Payment' : 'Order', entityId: (data.paymentId || data.orderId) ?? undefined, meta: { reason: data.reason, ...data.meta } }).catch(() => undefined);
  }

  async markReview(paymentId: string, status: 'UNDER_REVIEW' | 'CLEARED', actorId: string, reason: string) {
    const p = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!p) throw new NotFoundException({ message: 'Pagamento não encontrado', code: 'PAYMENT_NOT_FOUND' });
    await this.prisma.payment.update({ where: { id: paymentId }, data: { reviewStatus: status } });
    await this.auditAction('payment.review_marked', actorId, { paymentId, orderId: p.orderId, amount: money(p.amount), reason, oldState: p.reviewStatus, newState: status });
    return { paymentId, reviewStatus: status };
  }

  /**
   * Release a stuck reservation: only for awaiting_payment orders with NO pending/approved payment.
   * Uses the same transitionFromAwaiting (CAS + release in one transaction) as the expiry job.
   */
  async releaseReservation(orderId: string, actorId: string, reason: string) {
    const o = await this.prisma.order.findUnique({ where: { id: orderId }, include: { payments: { select: { id: true, status: true } } } });
    if (!o) throw new NotFoundException({ message: 'Pedido não encontrado', code: 'ORDER_NOT_FOUND' });
    if (o.status !== 'awaiting_payment') {
      throw new ConflictException({ message: `Pedido em ${o.status}: não há reserva a liberar`, code: 'ORDER_NOT_AWAITING' });
    }
    const active = o.payments.filter((p) => p.status === 'pending' || p.status === 'approved');
    if (active.length) {
      throw new ConflictException({
        message: 'Pedido tem pagamento pendente/aprovado — reconcilie antes de liberar a reserva',
        code: 'ORDER_HAS_ACTIVE_PAYMENT',
        details: { paymentIds: active.map((p) => p.id) },
      });
    }
    const won = await this.orders.transitionFromAwaiting(o.id, 'cancelled');
    await this.auditAction('order.reservation_released', actorId, { orderId: o.id, reason, oldState: 'awaiting_payment', newState: won ? 'cancelled' : o.status, meta: { won } });
    return { orderId: o.id, released: won };
  }

  async resolveDiscrepancy(id: string, status: 'RESOLVED' | 'ACKNOWLEDGED', actorId: string, reason: string) {
    const d = await this.prisma.financialDiscrepancy.findUnique({ where: { id } });
    if (!d) throw new NotFoundException({ message: 'Divergência não encontrada', code: 'DISCREPANCY_NOT_FOUND' });
    if (d.status === 'RESOLVED') return { discrepancy: d, idempotent: true };
    if (status === 'RESOLVED' && d.severity === 'CRITICAL' && reason.trim().length < 30) {
      throw new BadRequestException({ message: 'Divergência CRÍTICA exige motivo detalhado (mín. 30 caracteres)', code: 'CRITICAL_REASON_TOO_SHORT' });
    }
    const updated = await this.prisma.financialDiscrepancy.update({
      where: { id },
      data: status === 'RESOLVED'
        ? { status, resolvedAt: new Date(), resolvedBy: actorId, resolutionNote: reason.slice(0, 500) }
        : { status, resolutionNote: reason.slice(0, 500) },
    });
    await this.auditAction(`discrepancy.${status.toLowerCase()}`, actorId, { orderId: d.orderId, paymentId: d.paymentId, reason, oldState: d.status, newState: status, meta: { discrepancyId: d.id, type: d.type, severity: d.severity, conditionCleared: d.conditionCleared } });
    return { discrepancy: updated, idempotent: false };
  }

  /**
   * Manual ledger adjustment (ADJUSTMENT_CREATED). Idempotent by Idempotency-Key:
   *  - same key + same payload → returns the existing entry (replay, no new row);
   *  - same key + different payload → 409 IDEMPOTENCY_KEY_REUSED.
   * Append-only (DB trigger blocks UPDATE/DELETE); audited in the same transaction.
   */
  async createAdjustment(input: { idempotencyKey: string; direction: 'CREDIT' | 'DEBIT'; amount: number; paymentId?: string; orderId?: string; reason: string; actorId: string; actorRole?: string; correctsLedgerEntryId?: string }) {
    const amount = money(input.amount);
    if (!(amount >= 0.01)) throw new BadRequestException({ message: 'Valor inválido', code: 'INVALID_AMOUNT' });
    if (!input.paymentId && !input.orderId) {
      throw new BadRequestException({ message: 'Informe paymentId e/ou orderId', code: 'ADJUSTMENT_TARGET_REQUIRED' });
    }
    if (input.correctsLedgerEntryId && !input.paymentId) {
      throw new BadRequestException({ message: 'Correção de lançamento exige paymentId', code: 'CORRECTION_PAYMENT_REQUIRED' });
    }
    let orderId = input.orderId ?? null;
    let externalId: string | null = null;
    if (input.paymentId) {
      const p = await this.prisma.payment.findUnique({ where: { id: input.paymentId }, select: { id: true, orderId: true, externalId: true } });
      if (!p) throw new NotFoundException({ message: 'Pagamento não encontrado', code: 'PAYMENT_NOT_FOUND' });
      if (orderId && orderId !== p.orderId) {
        throw new BadRequestException({ message: 'orderId não corresponde ao pedido do pagamento', code: 'ADJUSTMENT_TARGET_MISMATCH' });
      }
      orderId = p.orderId;
      externalId = p.externalId;
    } else {
      const o = await this.prisma.order.findUnique({ where: { id: orderId! }, select: { id: true } });
      if (!o) throw new NotFoundException({ message: 'Pedido não encontrado', code: 'ORDER_NOT_FOUND' });
    }
    const key = `ADJUSTMENT_CREATED:${input.idempotencyKey}`;
    const fingerprint = { direction: input.direction, amount, paymentId: input.paymentId ?? null, orderId, corrects: input.correctsLedgerEntryId ?? null };
    const result = await this.prisma.$transaction(async (tx) => {
      // Serialize with every other writer of this payment's ledger (sync path, refunds, other adjustments).
      if (input.paymentId) await tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "id" = ${input.paymentId} FOR UPDATE`;
      const prior = await tx.financialLedgerEntry.findUnique({ where: { idempotencyKey: key } });
      if (prior) {
        const pm = (prior.meta ?? {}) as Record<string, unknown>;
        const same = prior.direction === fingerprint.direction && money(prior.amount) === amount
          && (prior.paymentId ?? null) === fingerprint.paymentId && (prior.orderId ?? null) === fingerprint.orderId
          && ((pm.correctsLedgerEntryId as string | undefined) ?? null) === fingerprint.corrects;
        if (!same) {
          throw new ConflictException({ message: 'Idempotency-Key já usada com outro conteúdo', code: 'IDEMPOTENCY_KEY_REUSED' });
        }
        return { entry: prior, idempotent: true };
      }
      let correction: { correctsLedgerEntryId: string; correctsEntryType: string; correctsIdempotencyKey: string } | null = null;
      if (input.correctsLedgerEntryId) {
        const target = await tx.financialLedgerEntry.findUnique({ where: { id: input.correctsLedgerEntryId } });
        if (!target || target.paymentId !== input.paymentId) {
          throw new BadRequestException({ message: 'Lançamento a corrigir não encontrado neste pagamento', code: 'CORRECTION_TARGET_NOT_FOUND' });
        }
        if (target.entryType === 'ADJUSTMENT_CREATED' || target.direction === 'NONE') {
          throw new BadRequestException({ message: 'Só lançamentos com efeito de saldo (não-ajuste) podem ser corrigidos', code: 'CORRECTION_TARGET_INVALID' });
        }
        if (target.direction === input.direction) {
          throw new BadRequestException({ message: `Correção deve ter direção oposta ao lançamento (${target.direction})`, code: 'CORRECTION_DIRECTION_INVALID' });
        }
        const already = await tx.financialLedgerEntry.aggregate({
          where: { entryType: 'ADJUSTMENT_CREATED', paymentId: input.paymentId, meta: { path: ['correctsLedgerEntryId'], equals: target.id } },
          _sum: { amount: true },
        });
        if (money(money(already._sum.amount) + amount) > money(target.amount) + 0.001) {
          throw new ConflictException({ message: `Correção excede o lançamento (R$ ${money(target.amount).toFixed(2)}, já corrigido R$ ${money(already._sum.amount).toFixed(2)})`, code: 'CORRECTION_EXCEEDS_ENTRY' });
        }
        correction = { correctsLedgerEntryId: target.id, correctsEntryType: target.entryType, correctsIdempotencyKey: target.idempotencyKey };
      }
      const inserted = await this.recorder.appendLedger(tx, {
        entryType: 'ADJUSTMENT_CREATED',
        direction: input.direction,
        amount,
        idempotencyKey: key,
        source: 'admin',
        paymentId: input.paymentId ?? null,
        orderId,
        externalId,
        actorId: input.actorId,
        meta: { reason: input.reason.slice(0, 500), manual: true, ...(correction ?? {}) },
      });
      const entry = await tx.financialLedgerEntry.findUniqueOrThrow({ where: { idempotencyKey: key } });
      if (!inserted) {
        // Concurrent request with the same key won (order-only adjustments have no row lock).
        const same = entry.direction === fingerprint.direction && money(entry.amount) === amount
          && (entry.paymentId ?? null) === fingerprint.paymentId && (entry.orderId ?? null) === fingerprint.orderId;
        if (!same) throw new ConflictException({ message: 'Idempotency-Key já usada com outro conteúdo', code: 'IDEMPOTENCY_KEY_REUSED' });
        return { entry, idempotent: true };
      }
      await this.recorder.audit(tx, {
        action: 'ledger.adjustment_created', origin: 'admin', actorId: input.actorId, actorRole: input.actorRole ?? 'admin',
        orderId, paymentId: input.paymentId ?? null, amount, reason: input.reason,
        meta: { ledgerEntryId: entry.id, direction: input.direction, ...(correction ?? {}) },
      });
      return { entry, idempotent: false };
    });
    if (!result.idempotent) {
      financeMetrics.inc('ledger_adjustments');
      await this.auditLog.log('finance.ledger.adjustment_created', { actorId: input.actorId, entity: input.paymentId ? 'Payment' : 'Order', entityId: (input.paymentId || orderId) ?? undefined, meta: { reason: input.reason, amount, direction: input.direction } }).catch(() => undefined);
    }
    return { entry: { ...result.entry, amount: money(result.entry.amount) }, idempotent: result.idempotent };
  }
}
