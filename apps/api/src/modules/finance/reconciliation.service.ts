import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma.service';
import { structuredLog } from '../../common/structured-log';
import { PENDING_PAYMENT_EXPIRY_GRACE_MS } from '../orders/reservation-expiry-policy';
import { releaseSchedulerLock, tryAcquireSchedulerLock } from '../orders/scheduler-lock';
import { PaymentsService, paymentApplyMutex } from '../payments/payments.service';
import { FinancialRecorder } from './financial-recorder.service';
import { RefundsService } from './refunds.service';
import { financeMetrics } from './finance-metrics';
import {
  checkInventory,
  checkOrder,
  checkPayment,
  type DiscrepancyCandidate,
  type ProviderSnapshot,
} from './reconciliation-checks';
import { currentPaymentState } from './payment-state-machine';

export type ReconcileScope = 'ORDER' | 'PAYMENT' | 'PERIOD' | 'DAILY';

export type ReconcileRequest = {
  scope: ReconcileScope;
  orderId?: string;
  paymentId?: string;
  from?: Date;
  to?: Date;
  /** Query Mercado Pago (read-only GET) for each payment. Default true. */
  withProvider?: boolean;
  /** Apply safe repairs (re-apply provider status through the webhook path, ledger backfill). */
  autoRepair?: boolean;
  triggeredBy?: string | null;
  origin: string;
};

const LOCK_TTL_MS = 10 * 60_000;
const MAX_PAYMENTS_PER_RUN = 500;
const money = (n: unknown) => Math.round(Number(n || 0) * 100) / 100;

/** Types that one reconciliation pass re-evaluates for a payment/order (used for "condition cleared"). */
const PAYMENT_TYPES = ['APPROVED_NOT_APPLIED', 'PENDING_STALE', 'REFUND_NOT_APPLIED', 'LOCAL_APPROVED_PROVIDER_NOT', 'AMOUNT_MISMATCH', 'REFUND_AMOUNT_MISMATCH', 'APPROVED_ORDER_NOT_PAID', 'APPROVED_ON_CANCELLED_ORDER', 'LEDGER_MISSING_CAPTURE', 'LEDGER_BALANCE_MISMATCH'];
const ORDER_TYPES = ['DOUBLE_PAYMENT', 'ORDER_PAID_WITHOUT_PAYMENT', 'RESERVATION_WITHOUT_PAYMENT', 'STOCK_NOT_COMMITTED', 'STOCK_NOT_RELEASED'];

@Injectable()
export class ReconciliationService {
  private readonly holder = `recon-${process.pid}-${randomUUID().slice(0, 8)}`;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PaymentsService) private readonly payments: PaymentsService,
    @Inject(FinancialRecorder) private readonly recorder: FinancialRecorder,
    @Inject(RefundsService) private readonly refunds: RefundsService,
  ) {}

  private lockId(req: ReconcileRequest) {
    if (req.scope === 'PAYMENT') return `finrecon:payment:${req.paymentId}`;
    if (req.scope === 'ORDER') return `finrecon:order:${req.orderId}`;
    return 'finrecon:global';
  }

  async run(req: ReconcileRequest) {
    if (req.scope === 'PAYMENT' && !req.paymentId) throw new BadRequestException({ message: 'paymentId obrigatório', code: 'PAYMENT_ID_REQUIRED' });
    if (req.scope === 'ORDER' && !req.orderId) throw new BadRequestException({ message: 'orderId obrigatório', code: 'ORDER_ID_REQUIRED' });
    const scopeRef = req.paymentId || req.orderId || (req.from || req.to ? `${req.from?.toISOString() ?? ''}..${req.to?.toISOString() ?? ''}` : null);
    const lockId = this.lockId(req);
    const holder = `${this.holder}-${randomUUID().slice(0, 6)}`;
    const acquired = await tryAcquireSchedulerLock(this.prisma, lockId, holder, LOCK_TTL_MS);
    if (!acquired) {
      const skipped = await this.prisma.financialReconciliationRun.create({
        data: { scope: req.scope, scopeRef, status: 'SKIPPED_LOCKED', triggeredBy: req.triggeredBy ?? null, origin: req.origin, finishedAt: new Date() },
      });
      return { runId: skipped.id, status: 'SKIPPED_LOCKED' as const, stats: null };
    }
    const run = await this.prisma.financialReconciliationRun.create({
      data: { scope: req.scope, scopeRef, status: 'RUNNING', triggeredBy: req.triggeredBy ?? null, origin: req.origin },
    });
    financeMetrics.inc('reconciliation_runs');
    const stats = { payments: 0, orders: 0, providerFetched: 0, providerErrors: 0, discrepancies: 0, created: 0, cleared: 0, repaired: 0, repairErrors: 0 };
    try {
      const { paymentIds, orderIds, global } = await this.selectSubjects(req);
      for (const pid of paymentIds.slice(0, MAX_PAYMENTS_PER_RUN)) {
        await this.reconcilePayment(pid, run.id, req, stats);
      }
      for (const oid of orderIds) {
        await this.reconcileOrder(oid, run.id, stats);
      }
      if (global) await this.reconcileGlobal(run.id, stats);
      await this.prisma.financialReconciliationRun.update({
        where: { id: run.id },
        data: { status: 'COMPLETED', stats, finishedAt: new Date() },
      });
      await this.recorder.auditSafe({ action: 'reconciliation.completed', origin: req.origin, actorId: req.triggeredBy ?? null, meta: { runId: run.id, scope: req.scope, scopeRef, ...stats } });
      structuredLog(stats.discrepancies ? 'warn' : 'info', 'FINANCIAL_RECONCILIATION_DONE', { runId: run.id, scope: req.scope, ...stats });
      return { runId: run.id, status: 'COMPLETED' as const, stats };
    } catch (e: any) {
      await this.prisma.financialReconciliationRun.update({
        where: { id: run.id },
        data: { status: 'FAILED', stats, error: String(e?.message || e).slice(0, 500), finishedAt: new Date() },
      }).catch(() => undefined);
      structuredLog('error', 'FINANCIAL_RECONCILIATION_FAILED', { runId: run.id, error: String(e?.message || e).slice(0, 200) });
      throw e;
    } finally {
      await releaseSchedulerLock(this.prisma, lockId, holder).catch(() => undefined);
    }
  }

  private async selectSubjects(req: ReconcileRequest) {
    if (req.scope === 'PAYMENT') {
      const p = await this.prisma.payment.findUnique({ where: { id: req.paymentId! }, select: { id: true, orderId: true } });
      if (!p) throw new NotFoundException({ message: 'Pagamento não encontrado', code: 'PAYMENT_NOT_FOUND' });
      return { paymentIds: [p.id], orderIds: [p.orderId], global: false };
    }
    if (req.scope === 'ORDER') {
      const o = await this.prisma.order.findUnique({ where: { id: req.orderId! }, select: { id: true, payments: { select: { id: true } } } });
      if (!o) throw new NotFoundException({ message: 'Pedido não encontrado', code: 'ORDER_NOT_FOUND' });
      return { paymentIds: o.payments.map((p) => p.id), orderIds: [o.id], global: false };
    }
    const to = req.to ?? new Date();
    const from = req.from ?? new Date(to.getTime() - (req.scope === 'DAILY' ? 3 : 1) * 86_400_000);
    const payments = await this.prisma.payment.findMany({
      where: {
        OR: [
          { updatedAt: { gte: from, lte: to } },
          { createdAt: { gte: from, lte: to } },
          // stale pending intents are always re-checked
          { status: 'pending', createdAt: { lte: new Date(Date.now() - 60 * 60_000) } },
          // approved without order confirmation
          { status: 'approved', order: { status: { in: ['awaiting_payment', 'cancelled'] } } },
        ],
      },
      select: { id: true, orderId: true },
      orderBy: { updatedAt: 'desc' },
      take: MAX_PAYMENTS_PER_RUN,
    });
    const orders = await this.prisma.order.findMany({
      where: {
        OR: [
          { updatedAt: { gte: from, lte: to } },
          { status: 'awaiting_payment', reservationExpiresAt: { lt: new Date(Date.now() - PENDING_PAYMENT_EXPIRY_GRACE_MS) } },
        ],
      },
      select: { id: true },
      take: 2000,
    });
    const orderIds = Array.from(new Set([...orders.map((o) => o.id), ...payments.map((p) => p.orderId)]));
    return { paymentIds: payments.map((p) => p.id), orderIds, global: true };
  }

  private async providerSnapshot(externalId: string, stats: { providerFetched: number; providerErrors: number }): Promise<ProviderSnapshot | undefined> {
    try {
      const f = await this.payments.fetchPaymentResolvingCollector(externalId);
      stats.providerFetched++;
      return { status: f.status, rawStatus: f.rawStatus, statusDetail: f.statusDetail, amount: f.amount, refundedAmount: f.refundedAmount ?? null, externalReference: f.externalReference ?? null };
    } catch (e: any) {
      stats.providerErrors++;
      financeMetrics.inc('provider_errors');
      structuredLog('warn', 'RECONCILIATION_PROVIDER_ERROR', { externalId, status: e?.status ?? null, error: String(e?.message || e).slice(0, 120) });
      return undefined;
    }
  }

  private async ledgerSnapshot(paymentId: string) {
    const rows = await this.prisma.financialLedgerEntry.groupBy({
      by: ['entryType', 'direction'],
      where: { paymentId },
      _sum: { amount: true },
      _count: { _all: true },
    });
    const sum = (t: string, d: string) => money(rows.find((r) => r.entryType === t && r.direction === d)?._sum.amount);
    return {
      captured: sum('PAYMENT_CAPTURED', 'CREDIT'),
      refunded: sum('REFUND_COMPLETED', 'DEBIT'),
      chargebackLost: sum('CHARGEBACK_LOST', 'DEBIT'),
      hasCapture: rows.some((r) => r.entryType === 'PAYMENT_CAPTURED'),
    };
  }

  async reconcilePayment(paymentId: string, runId: string, req: ReconcileRequest, stats: any) {
    const p = await this.prisma.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
    if (!p) return;
    stats.payments++;
    let provider: ProviderSnapshot | undefined;
    if (req.withProvider !== false && p.externalId && (p.provider === 'mercadopago' || p.provider === 'null')) {
      provider = await this.providerSnapshot(p.externalId, stats);
    }
    const found = checkPayment({
      payment: { id: p.id, orderId: p.orderId, status: p.status, financialState: p.financialState, externalId: p.externalId, amount: Number(p.amount), method: p.method, updatedAt: p.updatedAt },
      order: p.order ? { id: p.order.id, publicId: p.order.publicId, status: p.order.status, total: Number(p.order.total), reservationExpiresAt: p.order.reservationExpiresAt } : null,
      provider: provider ?? null,
      ledger: await this.ledgerSnapshot(p.id),
      refunds: (await this.prisma.paymentRefund.findMany({ where: { paymentId: p.id } })).map((r) => ({ id: r.id, status: r.status, amount: Number(r.amount), updatedAt: r.updatedAt })),
      now: new Date(),
    });

    if (req.autoRepair) {
      const repairs = new Set(found.map((f) => f.repair).filter(Boolean));
      if (repairs.has('REPROCESS_PAYMENT') && provider) {
        try {
          await this.reprocessPayment(p.id, { actorId: req.triggeredBy ?? null, origin: 'reconciliation', reason: `auto_repair run ${runId}` });
          stats.repaired++;
        } catch {
          stats.repairErrors++;
        }
      }
      if (repairs.has('BACKFILL_CAPTURE')) {
        await this.backfillLedger(p.id, provider ?? null, runId);
        stats.repaired++;
      }
      for (const f of found.filter((x) => x.repair === 'REFRESH_REFUND')) {
        try {
          await this.refunds.refreshFromProvider(String(f.details?.refundId));
          stats.repaired++;
        } catch {
          stats.repairErrors++;
        }
      }
    }
    // Re-evaluate after repairs so the persisted result reflects the current truth.
    const final = req.autoRepair ? await this.recheckPayment(p.id, provider) : found;
    await this.persist(final, runId, stats, { paymentId: p.id, types: provider ? PAYMENT_TYPES : PAYMENT_TYPES.filter((t) => !['APPROVED_NOT_APPLIED', 'PENDING_STALE', 'REFUND_NOT_APPLIED', 'LOCAL_APPROVED_PROVIDER_NOT', 'AMOUNT_MISMATCH', 'REFUND_AMOUNT_MISMATCH'].includes(t)) });
  }

  private async recheckPayment(paymentId: string, previousProvider: ProviderSnapshot | undefined) {
    const p = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { order: true } });
    return checkPayment({
      payment: { id: p.id, orderId: p.orderId, status: p.status, financialState: p.financialState, externalId: p.externalId, amount: Number(p.amount), method: p.method, updatedAt: p.updatedAt },
      order: { id: p.order.id, publicId: p.order.publicId, status: p.order.status, total: Number(p.order.total), reservationExpiresAt: p.order.reservationExpiresAt },
      provider: previousProvider ?? null,
      ledger: await this.ledgerSnapshot(p.id),
      refunds: (await this.prisma.paymentRefund.findMany({ where: { paymentId: p.id } })).map((r) => ({ id: r.id, status: r.status, amount: Number(r.amount), updatedAt: r.updatedAt })),
      now: new Date(),
    });
  }

  async reconcileOrder(orderId: string, runId: string, stats: any) {
    const o = await this.prisma.order.findUnique({ where: { id: orderId }, include: { payments: { select: { id: true, status: true } }, items: { select: { id: true } } } });
    if (!o) return;
    stats.orders++;
    const movements = await this.prisma.inventoryMovement.findMany({ where: { orderId: o.id }, select: { orderItemId: true, kind: true } });
    const found = checkOrder({
      order: { id: o.id, publicId: o.publicId, status: o.status, total: Number(o.total), reservationExpiresAt: o.reservationExpiresAt },
      payments: o.payments,
      movements,
      itemIds: o.items.map((i) => i.id),
      now: new Date(),
      expiryGraceMs: PENDING_PAYMENT_EXPIRY_GRACE_MS + 10 * 60_000,
    });
    await this.persist(found, runId, stats, { orderId: o.id, types: ORDER_TYPES });
  }

  async reconcileGlobal(runId: string, stats: any) {
    const inv = await this.prisma.$queryRaw<{ productId: string; sku: string; qtyOnHand: number; qtyReserved: number; reservedByOpenOrders: bigint }[]>`
      SELECT i."productId", p."sku", i."qtyOnHand", i."qtyReserved",
        COALESCE((SELECT SUM(oi."qty") FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId"
                  WHERE oi."productId" = i."productId" AND o."status" = 'awaiting_payment'::"OrderStatus"), 0) AS "reservedByOpenOrders"
      FROM "Inventory" i JOIN "Product" p ON p."id" = i."productId"
    `;
    const found: DiscrepancyCandidate[] = checkInventory(inv.map((r) => ({ ...r, reservedByOpenOrders: Number(r.reservedByOpenOrders) })));

    const dups = await this.prisma.$queryRaw<{ provider: string; externalId: string; n: bigint }[]>`
      SELECT "provider", "externalId", COUNT(*) AS n FROM "Payment"
      WHERE "externalId" IS NOT NULL GROUP BY "provider", "externalId" HAVING COUNT(*) > 1
    `;
    for (const d of dups) {
      found.push({ type: 'DUPLICATE_EXTERNAL_ID', severity: 'CRITICAL', dedupeKey: `DUPLICATE_EXTERNAL_ID:${d.provider}:${d.externalId}`, externalId: d.externalId,
        message: `${Number(d.n)} pagamentos locais apontam para o mesmo id do provedor ${d.externalId}.` });
    }
    const orphans = await this.prisma.paymentReconciliation.findMany({ where: { status: 'RECONCILIATION_REQUIRED', resolvedAt: null }, take: 500 });
    for (const r of orphans) {
      const risk = r.reason === 'orphan_approved' || r.reason === 'orphan_paid_status';
      const integrity = r.reason === 'amount_mismatch' || r.reason === 'reference_mismatch';
      found.push({
        type: integrity ? 'PROVIDER_INTEGRITY_MISMATCH' : 'PAYMENT_WITHOUT_ORDER',
        severity: risk || integrity ? 'CRITICAL' : 'LOW',
        dedupeKey: `${integrity ? 'PROVIDER_INTEGRITY_MISMATCH' : 'PAYMENT_WITHOUT_ORDER'}:${r.provider}:${r.externalId}`,
        externalId: r.externalId,
        message: `Fila de reconciliação aberta (${r.reason}) para pagamento ${r.externalId} no provedor (${r.providerStatus}).`,
        details: { paymentReconciliationId: r.id },
      });
    }
    const failedWebhooks = await this.prisma.paymentEvent.count({
      where: { processingStatus: 'FAILED', createdAt: { lt: new Date(Date.now() - 15 * 60_000), gt: new Date(Date.now() - 7 * 86_400_000) } },
    });
    if (failedWebhooks > 0) {
      found.push({ type: 'WEBHOOK_FAILURES', severity: 'MEDIUM', dedupeKey: 'WEBHOOK_FAILURES:recent', message: `${failedWebhooks} webhook(s) com falha nos últimos 7 dias (sem reprocessamento posterior).`, actual: String(failedWebhooks) });
    }
    await this.persist(found, runId, stats, { global: true, types: ['STOCK_INVALID', 'STOCK_RESERVED_DRIFT', 'DUPLICATE_EXTERNAL_ID', 'WEBHOOK_FAILURES'] });
  }

  /**
   * Upsert found discrepancies; for the evaluated subject, mark previously-open ones that were not
   * observed as conditionCleared. LOW/MEDIUM are then auto-resolved (audited); HIGH/CRITICAL stay
   * open until a human resolves them — critical is never silently resolved.
   */
  private async persist(found: DiscrepancyCandidate[], runId: string, stats: any, subject: { paymentId?: string; orderId?: string; global?: boolean; types: string[] }) {
    for (const f of found) {
      const { repair: _r, ...d } = f;
      const res = await this.recorder.openDiscrepancy(this.prisma, { ...d, runId });
      stats.discrepancies++;
      if (res.created) stats.created++;
    }
    const seen = new Set(found.map((f) => f.dedupeKey));
    const where: any = { status: { not: 'RESOLVED' }, type: { in: subject.types }, conditionCleared: false };
    if (subject.paymentId) where.paymentId = subject.paymentId;
    else if (subject.orderId) { where.orderId = subject.orderId; where.paymentId = null; }
    else if (!subject.global) return;
    const open = await this.prisma.financialDiscrepancy.findMany({ where, take: 1000 });
    for (const d of open) {
      if (seen.has(d.dedupeKey)) continue;
      stats.cleared++;
      if (d.severity === 'LOW' || d.severity === 'MEDIUM') {
        await this.prisma.financialDiscrepancy.update({
          where: { id: d.id },
          data: { conditionCleared: true, status: 'RESOLVED', resolvedAt: new Date(), resolvedBy: 'reconciliation', resolutionNote: `Condição não observada no run ${runId}` },
        });
        await this.recorder.auditSafe({ action: 'discrepancy.auto_resolved', origin: 'reconciliation', orderId: d.orderId, paymentId: d.paymentId, reason: `condition_cleared run ${runId}`, meta: { discrepancyId: d.id, type: d.type, severity: d.severity } });
      } else {
        await this.prisma.financialDiscrepancy.update({ where: { id: d.id }, data: { conditionCleared: true, lastRunId: runId } });
      }
    }
  }

  /** Ledger backfill for money-received payments recorded before the ledger existed. Idempotent. */
  async backfillLedger(paymentId: string, provider: ProviderSnapshot | null, runId: string) {
    const p = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const state = currentPaymentState(p);
    if (!['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'IN_DISPUTE', 'CHARGEBACK_WON', 'CHARGEBACK_LOST'].includes(state)) return;
    const base = { paymentId: p.id, orderId: p.orderId, externalId: p.externalId, source: 'reconciliation_backfill' };
    await this.recorder.appendLedger(this.prisma, { ...base, entryType: 'PAYMENT_CAPTURED', direction: 'CREDIT', amount: Number(p.amount), idempotencyKey: `PAYMENT_CAPTURED:${p.id}`, meta: { backfill: true, runId, paymentUpdatedAt: p.updatedAt.toISOString() } });
    const refundedLedger = await this.recorder.ledgerRefundedTotal(this.prisma, p.id);
    const shouldBe = provider?.refundedAmount != null ? money(provider.refundedAmount) : state === 'REFUNDED' ? money(p.amount) : refundedLedger;
    const delta = money(Math.min(shouldBe, Number(p.amount)) - refundedLedger);
    if (delta > 0.009) {
      await this.recorder.appendLedger(this.prisma, { ...base, entryType: 'REFUND_COMPLETED', direction: 'DEBIT', amount: delta, idempotencyKey: `REFUND_COMPLETED:sync:${p.id}:${Math.round(Math.min(shouldBe, Number(p.amount)) * 100)}`, meta: { backfill: true, runId } });
    }
  }

  /**
   * Re-fetch a payment from Mercado Pago and apply it through the SAME path as a webhook
   * (applyProviderStatus + financial sync), serialized per payment. Safe to repeat.
   */
  async reprocessPayment(paymentId: string, opts: { actorId: string | null; origin: string; reason: string }) {
    const p = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!p) throw new NotFoundException({ message: 'Pagamento não encontrado', code: 'PAYMENT_NOT_FOUND' });
    if (!p.externalId) throw new BadRequestException({ message: 'Pagamento sem id do provedor', code: 'PAYMENT_NO_EXTERNAL_ID' });
    const fetched = await this.payments.fetchPaymentResolvingCollector(p.externalId);
    const result = await paymentApplyMutex.run(p.id, async () => {
      const r = await this.payments.applyProviderStatus(p.id, {
        status: fetched.status,
        amount: fetched.amount,
        externalReference: fetched.externalReference,
        externalId: fetched.externalId,
        payload: fetched.payload,
      });
      await this.payments.syncFinancialAfterProviderFetch(p, fetched, r, opts.origin);
      return r;
    });
    await this.recorder.auditSafe({
      action: 'payment.reprocessed',
      origin: opts.origin,
      actorId: opts.actorId,
      orderId: p.orderId,
      paymentId: p.id,
      amount: Number(p.amount),
      reason: opts.reason,
      meta: { providerStatus: fetched.rawStatus ?? fetched.status, applied: result.applied, applyReason: result.reason },
    });
    return { paymentId: p.id, providerStatus: fetched.rawStatus ?? fetched.status, ...result };
  }
}
