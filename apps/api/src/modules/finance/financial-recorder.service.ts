import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma.service';
import { structuredLog } from '../../common/structured-log';
import {
  canPaymentTransition,
  currentPaymentState,
  isPaymentState,
  resolveTargetState,
  type PaymentState,
  type ProviderObservation,
} from './payment-state-machine';
import { financeMetrics } from './finance-metrics';

type Db = PrismaService | Prisma.TransactionClient;

export type LedgerEntryType =
  | 'PAYMENT_CREATED'
  | 'PAYMENT_CAPTURED'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_CANCELLED'
  | 'PAYMENT_EXPIRED'
  | 'REFUND_CREATED'
  | 'REFUND_COMPLETED'
  | 'REFUND_FAILED'
  | 'CHARGEBACK_OPENED'
  | 'CHARGEBACK_WON'
  | 'CHARGEBACK_LOST'
  | 'ADJUSTMENT_CREATED';

export type LedgerDirection = 'CREDIT' | 'DEBIT' | 'NONE';

export type LedgerInput = {
  entryType: LedgerEntryType;
  direction: LedgerDirection;
  amount: number;
  idempotencyKey: string;
  source: string;
  paymentId?: string | null;
  orderId?: string | null;
  refundId?: string | null;
  chargebackId?: string | null;
  externalId?: string | null;
  actorId?: string | null;
  meta?: Record<string, unknown>;
};

export type FinancialAuditInput = {
  action: string;
  origin: string;
  actorId?: string | null;
  actorRole?: string | null;
  orderId?: string | null;
  paymentId?: string | null;
  refundId?: string | null;
  amount?: number | null;
  oldState?: string | null;
  newState?: string | null;
  reason?: string | null;
  meta?: Record<string, unknown>;
};

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type DiscrepancyInput = {
  type: string;
  severity: Severity;
  dedupeKey: string;
  message: string;
  orderId?: string | null;
  paymentId?: string | null;
  externalId?: string | null;
  expected?: string | null;
  actual?: string | null;
  details?: Record<string, unknown>;
  runId?: string | null;
};

export type SyncOptions = {
  source: string;
  obs?: ProviderObservation | null;
  reason?: string | null;
  actorId?: string | null;
  actorRole?: string | null;
  chargebackId?: string | null;
};

export type SyncResult = {
  applied: boolean;
  from: PaymentState;
  to: PaymentState;
  forbidden?: boolean;
  reason: string;
};

const TX_OPTS = { maxWait: 20_000, timeout: 20_000 } as const;

function money(n: unknown) {
  return Math.round(Number(n || 0) * 100) / 100;
}

function trunc(s: unknown, n: number) {
  const v = s == null ? null : String(s);
  return v && v.length > n ? v.slice(0, n) : v;
}

/** Canonical ledger key for a completed provider refund. Used by BOTH the refund engine and the
 *  webhook/reconciliation sync path, so the unique idempotencyKey makes a double debit impossible. */
export const REFUND_MP_KEY_PREFIX = 'REFUND_COMPLETED:mp:';
export function refundLedgerKey(providerRefundId: string) {
  return `${REFUND_MP_KEY_PREFIX}${providerRefundId}`;
}

export type RefundLedgerRow = {
  id: string;
  entryType: string;
  direction: string;
  amount: unknown;
  refundId: string | null;
  idempotencyKey: string;
  meta: unknown;
};

/** Amount of each ledger entry that was corrected by an append-only corrective adjustment. */
export function correctionsByEntry(rows: RefundLedgerRow[]): Map<string, { amount: number; entryType: string | null }> {
  const out = new Map<string, { amount: number; entryType: string | null }>();
  for (const r of rows) {
    if (r.entryType !== 'ADJUSTMENT_CREATED') continue;
    const m = (r.meta ?? {}) as Record<string, unknown>;
    const target = typeof m.correctsLedgerEntryId === 'string' ? m.correctsLedgerEntryId : null;
    if (!target) continue;
    const prev = out.get(target);
    out.set(target, { amount: money((prev?.amount ?? 0) + money(r.amount)), entryType: (m.correctsEntryType as string) ?? prev?.entryType ?? null });
  }
  return out;
}

/**
 * Pure: refund debits net of corrective adjustments.
 *  - total: effective REFUND_COMPLETED debits;
 *  - external: the part not attributable to a local PaymentRefund (MP panel / legacy), i.e. no refundId
 *    and not keyed by a provider refund id that a local refund owns.
 */
export function summarizeRefundLedger(rows: RefundLedgerRow[], localProviderRefundIds: Set<string>) {
  const corr = correctionsByEntry(rows);
  let total = 0;
  let external = 0;
  for (const r of rows) {
    if (r.entryType !== 'REFUND_COMPLETED' || r.direction !== 'DEBIT') continue;
    const eff = Math.max(0, money(money(r.amount) - (corr.get(r.id)?.amount ?? 0)));
    total = money(total + eff);
    if (!r.refundId) {
      const m = (r.meta ?? {}) as Record<string, unknown>;
      const mpId = r.idempotencyKey.startsWith(REFUND_MP_KEY_PREFIX)
        ? r.idempotencyKey.slice(REFUND_MP_KEY_PREFIX.length)
        : typeof m.providerRefundId === 'string' ? m.providerRefundId : null;
      if (!(mpId && localProviderRefundIds.has(mpId))) external = money(external + eff);
    }
  }
  return { total, external };
}

const INFLIGHT_REFUND_STATUSES = ['REQUESTED', 'PROCESSING', 'UNKNOWN'];

/**
 * Core financial writer: state transitions + append-only ledger + immutable audit + discrepancies.
 * Depends only on Prisma so it can be injected everywhere (global module) without cycles.
 */
@Injectable()
export class FinancialRecorder {
  private readonly log = new Logger(FinancialRecorder.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Idempotent ledger append (ON CONFLICT (idempotencyKey) DO NOTHING). Returns true if inserted. */
  async appendLedger(db: Db, e: LedgerInput): Promise<boolean> {
    const amount = money(e.amount);
    if (!(amount >= 0)) throw new Error('ledger amount must be >= 0');
    const res = await db.financialLedgerEntry.createMany({
      data: [
        {
          id: randomUUID(),
          entryType: e.entryType,
          direction: e.direction,
          amount,
          paymentId: e.paymentId ?? null,
          orderId: e.orderId ?? null,
          refundId: e.refundId ?? null,
          chargebackId: e.chargebackId ?? null,
          externalId: trunc(e.externalId, 80),
          source: e.source,
          actorId: e.actorId ?? null,
          idempotencyKey: e.idempotencyKey,
          meta: (e.meta ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      ],
      skipDuplicates: true,
    });
    return res.count > 0;
  }

  async audit(db: Db, a: FinancialAuditInput): Promise<void> {
    await db.financialAuditEvent.create({
      data: {
        action: a.action,
        origin: a.origin,
        actorId: a.actorId ?? null,
        actorRole: a.actorRole ?? null,
        orderId: a.orderId ?? null,
        paymentId: a.paymentId ?? null,
        refundId: a.refundId ?? null,
        amount: a.amount != null ? money(a.amount) : null,
        oldState: a.oldState ?? null,
        newState: a.newState ?? null,
        reason: trunc(a.reason, 500),
        meta: (a.meta ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }

  /** Audit that never throws (for best-effort paths outside a transaction). */
  async auditSafe(a: FinancialAuditInput): Promise<void> {
    try {
      await this.audit(this.prisma, a);
    } catch (e: any) {
      financeMetrics.inc('finance_hook_failures');
      structuredLog('error', 'FINANCE_AUDIT_FAILED', { action: a.action, error: String(e?.message || e).slice(0, 200) });
    }
  }

  /**
   * Upsert a discrepancy by dedupeKey. A resolved discrepancy that re-occurs is re-opened.
   * Returns { id, created }.
   */
  async openDiscrepancy(db: Db, d: DiscrepancyInput): Promise<{ id: string; created: boolean }> {
    const existing = await db.financialDiscrepancy.findUnique({ where: { dedupeKey: d.dedupeKey } });
    if (existing) {
      const reopened = existing.status === 'RESOLVED';
      await db.financialDiscrepancy.update({
        where: { id: existing.id },
        data: {
          occurrences: { increment: 1 },
          lastSeenAt: new Date(),
          lastRunId: d.runId ?? existing.lastRunId,
          conditionCleared: false,
          severity: d.severity,
          message: trunc(d.message, 500)!,
          expected: trunc(d.expected, 200),
          actual: trunc(d.actual, 200),
          details: (d.details ?? undefined) as Prisma.InputJsonValue | undefined,
          ...(reopened ? { status: 'OPEN', resolvedAt: null, resolvedBy: null } : {}),
        },
      });
      if (reopened) financeMetrics.inc('discrepancies_created');
      return { id: existing.id, created: false };
    }
    try {
      const row = await db.financialDiscrepancy.create({
        data: {
          type: d.type,
          severity: d.severity,
          dedupeKey: d.dedupeKey,
          message: trunc(d.message, 500)!,
          orderId: d.orderId ?? null,
          paymentId: d.paymentId ?? null,
          externalId: trunc(d.externalId, 80),
          expected: trunc(d.expected, 200),
          actual: trunc(d.actual, 200),
          details: (d.details ?? undefined) as Prisma.InputJsonValue | undefined,
          lastRunId: d.runId ?? null,
        },
      });
      financeMetrics.inc('discrepancies_created');
      structuredLog(d.severity === 'CRITICAL' || d.severity === 'HIGH' ? 'error' : 'warn', 'FINANCIAL_DISCREPANCY', {
        discrepancyId: row.id,
        type: d.type,
        severity: d.severity,
        orderId: d.orderId ?? null,
        paymentId: d.paymentId ?? null,
      });
      return { id: row.id, created: true };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        // concurrent creator won — count as an occurrence
        return this.openDiscrepancy(db, d);
      }
      throw e;
    }
  }

  /** Refund debits for a payment, net of corrective adjustments (total + external part). */
  async refundLedgerSummary(db: Db, paymentId: string): Promise<{ total: number; external: number }> {
    const rows = await db.financialLedgerEntry.findMany({
      where: { paymentId, entryType: { in: ['REFUND_COMPLETED', 'ADJUSTMENT_CREATED'] } },
      select: { id: true, entryType: true, direction: true, amount: true, refundId: true, idempotencyKey: true, meta: true },
    });
    const local = await db.paymentRefund.findMany({ where: { paymentId, providerRefundId: { not: null } }, select: { providerRefundId: true } });
    return summarizeRefundLedger(rows, new Set(local.map((r) => r.providerRefundId!)));
  }

  /** Sum of completed refund debits in the ledger for a payment (net of corrective adjustments). */
  async ledgerRefundedTotal(db: Db, paymentId: string): Promise<number> {
    return (await this.refundLedgerSummary(db, paymentId)).total;
  }

  /**
   * Bring REFUND_COMPLETED debits up to what the provider reports as refunded. Caller holds the
   * Payment row lock (FOR UPDATE), the same lock RefundsService.markCompleted takes.
   *  - With provider refund ids: one entry per approved refund under the canonical key
   *    REFUND_COMPLETED:mp:<id> (shared with the refund engine → unique index dedupes either order).
   *  - Without ids (legacy observation): amount delta, minus local refunds still in flight
   *    (their completion writes the debit), so a webhook that beats the MP response can't double count.
   * Never exceeds min(target, payment amount). Returns the amount written.
   */
  async recordObservedRefunds(
    tx: Db,
    p: { id: string; orderId: string; amount: Prisma.Decimal | number; externalId: string | null },
    o: { target: number; providerRefunds?: { refundId: string; status: string; amount: number }[] | null; source: string; actorId?: string | null; meta?: Record<string, unknown> },
  ): Promise<number> {
    const cap = money(Math.min(money(o.target), money(p.amount)));
    let covered = await this.ledgerRefundedTotal(tx, p.id);
    let written = 0;
    const base = { paymentId: p.id, orderId: p.orderId, externalId: p.externalId, source: o.source, actorId: o.actorId ?? null };
    const approved = (o.providerRefunds || []).filter((r) => r && r.refundId && String(r.status).toLowerCase() === 'approved');
    if (approved.length) {
      for (const r of approved) {
        const key = refundLedgerKey(r.refundId);
        if (await tx.financialLedgerEntry.findUnique({ where: { idempotencyKey: key }, select: { id: true } })) continue;
        const local = await tx.paymentRefund.findFirst({ where: { paymentId: p.id, providerRefundId: r.refundId }, select: { id: true } });
        // Refund completed before canonical keys existed: its debit lives under REFUND_COMPLETED:<refundId>.
        if (local && (await tx.financialLedgerEntry.findUnique({ where: { idempotencyKey: `REFUND_COMPLETED:${local.id}` }, select: { id: true } }))) continue;
        const room = money(cap - covered);
        if (room <= 0.009) break;
        const amt = money(Math.min(money(r.amount), room));
        const ok = await this.appendLedger(tx, {
          ...base,
          entryType: 'REFUND_COMPLETED',
          direction: 'DEBIT',
          amount: amt,
          idempotencyKey: key,
          refundId: local?.id ?? null,
          meta: { reason: 'provider_refund_observed', providerRefundId: r.refundId, ...(o.meta ?? {}) },
        });
        if (ok) {
          covered = money(covered + amt);
          written = money(written + amt);
        }
      }
      return written;
    }
    const inflight = await tx.paymentRefund.aggregate({
      where: { paymentId: p.id, status: { in: INFLIGHT_REFUND_STATUSES } },
      _sum: { amount: true },
    });
    const delta = money(cap - covered - money(inflight._sum.amount));
    if (delta > 0.009) {
      const ok = await this.appendLedger(tx, {
        ...base,
        entryType: 'REFUND_COMPLETED',
        direction: 'DEBIT',
        amount: delta,
        idempotencyKey: `REFUND_COMPLETED:sync:${p.id}:${Math.round(cap * 100)}`,
        meta: { reason: 'provider_or_legacy_refund_observed', observedRefunded: cap, ...(o.meta ?? {}) },
      });
      if (ok) written = delta;
    }
    return written;
  }

  /**
   * Align Payment.financialState with the local status (+ provider observation), under a row lock.
   * Idempotent: same target = no-op. Forbidden transitions never apply; they are audited and
   * raised as HIGH discrepancies.
   */
  async syncPaymentState(paymentId: string, opts: SyncOptions): Promise<SyncResult> {
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "id" = ${paymentId} FOR UPDATE`;
      const p = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!p) return { applied: false, from: 'PENDING', to: 'PENDING', reason: 'missing' } as SyncResult;
      // Legacy rows (financialState NULL) whose history was backfilled: the last recorded transition is
      // the true "from". Deriving it from the (already updated) local status would hide the change.
      let from = currentPaymentState(p);
      if (!isPaymentState(p.financialState)) {
        const last = await tx.paymentStateTransition.findFirst({ where: { paymentId: p.id }, orderBy: [{ createdAt: 'desc' }, { eventKey: 'desc' }], select: { toState: true } });
        if (last && isPaymentState(last.toState)) from = last.toState;
      }
      const local = { status: p.status, externalId: p.externalId, amount: Number(p.amount) };
      const to = resolveTargetState(from, local, opts.obs);
      const eventRef = `${opts.source}`;

      if (from === to) {
        // Legacy row that never had financialState: persist the derived state once (no transition,
        // no ledger — historical ledger backfill is an explicit reconciliation action).
        if (!p.financialState) {
          await tx.payment.update({ where: { id: p.id }, data: { financialState: to, financialStateAt: new Date() } });
        }
        // Already (partially) refunded and the provider reports refunds: catch up missing debits
        // (e.g. a 2nd partial refund done in the MP panel). Canonical keys keep this idempotent.
        if ((to === 'PARTIALLY_REFUNDED' || to === 'REFUNDED') && opts.obs && (opts.obs.refunds?.length || Number(opts.obs.refundedAmount) > 0)) {
          const target = Number(opts.obs.refundedAmount) > 0 ? money(opts.obs.refundedAmount) : to === 'REFUNDED' ? money(p.amount) : 0;
          const written = await this.recordObservedRefunds(tx, p, { target, providerRefunds: opts.obs.refunds, source: opts.source, actorId: opts.actorId });
          if (written > 0) {
            await this.audit(tx, {
              action: 'ledger.refund_observed', origin: opts.source, actorId: opts.actorId, actorRole: opts.actorRole,
              orderId: p.orderId, paymentId: p.id, amount: written, oldState: from, newState: to, reason: opts.reason ?? null,
            });
          }
        }
        return { applied: false, from, to, reason: 'same_state' } as SyncResult;
      }

      if (!canPaymentTransition(from, to)) {
        financeMetrics.inc('forbidden_transitions');
        await this.audit(tx, {
          action: 'payment.transition_forbidden',
          origin: opts.source,
          actorId: opts.actorId,
          actorRole: opts.actorRole,
          orderId: p.orderId,
          paymentId: p.id,
          amount: Number(p.amount),
          oldState: from,
          newState: to,
          reason: opts.reason || 'forbidden_by_state_machine',
          meta: { localStatus: p.status, providerStatus: opts.obs?.rawStatus ?? null },
        });
        await this.openDiscrepancy(tx, {
          type: 'FORBIDDEN_TRANSITION',
          severity: 'HIGH',
          dedupeKey: `FORBIDDEN_TRANSITION:${p.id}:${from}->${to}`,
          message: `Transição proibida bloqueada: ${from} → ${to} (status local ${p.status}, provedor ${opts.obs?.rawStatus ?? 'n/d'})`,
          orderId: p.orderId,
          paymentId: p.id,
          externalId: p.externalId,
          expected: from,
          actual: to,
        });
        structuredLog('error', 'PAYMENT_TRANSITION_FORBIDDEN', { paymentId: p.id, orderId: p.orderId, from, to });
        return { applied: false, from, to, forbidden: true, reason: 'forbidden' } as SyncResult;
      }

      const seq = (await tx.paymentStateTransition.count({ where: { paymentId: p.id } })) + 1;
      await tx.paymentStateTransition.create({
        data: {
          paymentId: p.id,
          orderId: p.orderId,
          fromState: from,
          toState: to,
          source: opts.source,
          reason: trunc(opts.reason, 500),
          actorId: opts.actorId ?? null,
          eventKey: `seq:${seq}`,
          amount: Number(p.amount),
        },
      });
      await tx.payment.update({ where: { id: p.id }, data: { financialState: to, financialStateAt: new Date() } });
      await this.audit(tx, {
        action: 'payment.state_transition',
        origin: opts.source,
        actorId: opts.actorId,
        actorRole: opts.actorRole,
        orderId: p.orderId,
        paymentId: p.id,
        amount: Number(p.amount),
        oldState: from,
        newState: to,
        reason: opts.reason ?? null,
        meta: { eventRef, providerStatus: opts.obs?.rawStatus ?? null, providerDetail: opts.obs?.statusDetail ?? null },
      });
      await this.ledgerForState(tx, p, to, opts, from);
      return { applied: true, from, to, reason: 'transitioned' } as SyncResult;
    }, TX_OPTS);

    if (result.applied) {
      const counter =
        result.to === 'PAID' ? 'payments_paid'
          : result.to === 'FAILED' ? 'payments_failed'
            : result.to === 'EXPIRED' ? 'payments_expired'
              : result.to === 'CANCELLED' ? 'payments_cancelled'
                : result.to === 'PENDING' ? 'payments_pending'
                  : result.to === 'IN_DISPUTE' ? 'chargebacks_opened'
                    : result.to === 'CHARGEBACK_WON' || result.to === 'CHARGEBACK_LOST' ? 'chargebacks_resolved'
                      : null;
      if (counter) financeMetrics.inc(counter);
    }
    return result;
  }

  /** New local Payment row: initial state + PAYMENT_CREATED ledger (informational). Idempotent. */
  async recordPaymentCreated(paymentId: string, opts: { source: string; actorId?: string | null }): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "id" = ${paymentId} FOR UPDATE`;
      const p = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!p) return false;
      const already = await tx.paymentStateTransition.findUnique({
        where: { paymentId_eventKey: { paymentId: p.id, eventKey: 'created' } },
      });
      if (already) return false;
      // Refused at creation (card): the attempt existed at the provider first (PENDING), then the
      // regular sync records PENDING→FAILED with its PAYMENT_FAILED ledger entry.
      const state: PaymentState = p.status === 'refused' ? (p.externalId ? 'PENDING' : 'CREATED') : currentPaymentState(p);
      await tx.paymentStateTransition.create({
        data: {
          paymentId: p.id,
          orderId: p.orderId,
          fromState: null,
          toState: state,
          source: opts.source,
          actorId: opts.actorId ?? null,
          eventKey: 'created',
          amount: Number(p.amount),
        },
      });
      if (!p.financialState) {
        await tx.payment.update({ where: { id: p.id }, data: { financialState: state, financialStateAt: new Date() } });
      }
      await this.appendLedger(tx, {
        entryType: 'PAYMENT_CREATED',
        direction: 'NONE',
        amount: Number(p.amount),
        idempotencyKey: `PAYMENT_CREATED:${p.id}`,
        source: opts.source,
        paymentId: p.id,
        orderId: p.orderId,
        externalId: p.externalId,
        actorId: opts.actorId ?? null,
        meta: { method: p.method },
      });
      await this.audit(tx, {
        action: 'payment.created',
        origin: opts.source,
        actorId: opts.actorId,
        orderId: p.orderId,
        paymentId: p.id,
        amount: Number(p.amount),
        newState: state,
        meta: { method: p.method, provider: p.provider },
      });
      financeMetrics.inc('payments_created');
      return true;
    }, TX_OPTS);
  }

  async recordPaymentCreatedSafe(paymentId: string, opts: { source: string; actorId?: string | null }) {
    try {
      return await this.recordPaymentCreated(paymentId, opts);
    } catch (e: any) {
      financeMetrics.inc('finance_hook_failures');
      structuredLog('error', 'FINANCE_HOOK_FAILED', { paymentId, source: opts.source, error: String(e?.message || e).slice(0, 200) });
      return false;
    }
  }

  /** Best-effort wrapper used from legacy flows: never throws, never blocks checkout. */
  async syncPaymentStateSafe(paymentId: string, opts: SyncOptions): Promise<SyncResult | null> {
    try {
      return await this.syncPaymentState(paymentId, opts);
    } catch (e: any) {
      financeMetrics.inc('finance_hook_failures');
      structuredLog('error', 'FINANCE_HOOK_FAILED', {
        paymentId,
        source: opts.source,
        error: String(e?.message || e).slice(0, 200),
      });
      return null;
    }
  }

  /** Ledger entries implied by reaching `to`. All keys deterministic → exactly once. */
  private async ledgerForState(
    tx: Prisma.TransactionClient,
    p: { id: string; orderId: string; amount: Prisma.Decimal | number; externalId: string | null },
    to: PaymentState,
    opts: SyncOptions,
    from: PaymentState,
  ) {
    const amount = money(p.amount);
    const base = { paymentId: p.id, orderId: p.orderId, externalId: p.externalId, source: opts.source, actorId: opts.actorId ?? null };
    switch (to) {
      case 'CREATED':
      case 'PENDING':
      case 'AUTHORIZED':
        await this.appendLedger(tx, { ...base, entryType: 'PAYMENT_CREATED', direction: 'NONE', amount, idempotencyKey: `PAYMENT_CREATED:${p.id}` });
        return;
      case 'PAID':
        if (from !== 'IN_DISPUTE') {
          await this.appendLedger(tx, { ...base, entryType: 'PAYMENT_CAPTURED', direction: 'CREDIT', amount, idempotencyKey: `PAYMENT_CAPTURED:${p.id}`, meta: from === 'EXPIRED' || from === 'CANCELLED' ? { lateCapture: true, from } : undefined });
        }
        return;
      case 'FAILED':
        await this.appendLedger(tx, { ...base, entryType: 'PAYMENT_FAILED', direction: 'NONE', amount, idempotencyKey: `PAYMENT_FAILED:${p.id}` });
        return;
      case 'CANCELLED':
        await this.appendLedger(tx, { ...base, entryType: 'PAYMENT_CANCELLED', direction: 'NONE', amount, idempotencyKey: `PAYMENT_CANCELLED:${p.id}` });
        return;
      case 'EXPIRED':
        await this.appendLedger(tx, { ...base, entryType: 'PAYMENT_EXPIRED', direction: 'NONE', amount, idempotencyKey: `PAYMENT_EXPIRED:${p.id}` });
        return;
      case 'PARTIALLY_REFUNDED':
      case 'REFUNDED': {
        // Money-received legacy rows first need their capture in the ledger.
        await this.appendLedger(tx, { ...base, entryType: 'PAYMENT_CAPTURED', direction: 'CREDIT', amount, idempotencyKey: `PAYMENT_CAPTURED:${p.id}`, meta: { backfilledOn: to } });
        const refundedLedger = await this.ledgerRefundedTotal(tx, p.id);
        const observed =
          opts.obs?.refundedAmount != null && Number(opts.obs.refundedAmount) > 0
            ? money(opts.obs.refundedAmount)
            : to === 'REFUNDED'
              ? amount
              : refundedLedger;
        await this.recordObservedRefunds(tx, p, { target: observed, providerRefunds: opts.obs?.refunds, source: opts.source, actorId: opts.actorId });
        return;
      }
      case 'IN_DISPUTE':
        await this.appendLedger(tx, { ...base, entryType: 'CHARGEBACK_OPENED', direction: 'NONE', amount, chargebackId: opts.chargebackId ?? null, idempotencyKey: `CHARGEBACK_OPENED:${p.id}` });
        return;
      case 'CHARGEBACK_WON':
        await this.appendLedger(tx, { ...base, entryType: 'CHARGEBACK_WON', direction: 'NONE', amount, chargebackId: opts.chargebackId ?? null, idempotencyKey: `CHARGEBACK_WON:${p.id}` });
        return;
      case 'CHARGEBACK_LOST': {
        await this.appendLedger(tx, { ...base, entryType: 'PAYMENT_CAPTURED', direction: 'CREDIT', amount, idempotencyKey: `PAYMENT_CAPTURED:${p.id}`, meta: { backfilledOn: to } });
        const refunded = await this.ledgerRefundedTotal(tx, p.id);
        const lost = money(amount - refunded);
        if (lost > 0.009) {
          await this.appendLedger(tx, { ...base, entryType: 'CHARGEBACK_LOST', direction: 'DEBIT', amount: lost, chargebackId: opts.chargebackId ?? null, idempotencyKey: `CHARGEBACK_LOST:${p.id}` });
        }
        return;
      }
    }
  }
}
