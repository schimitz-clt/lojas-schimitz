/**
 * Legacy backfill: gives payments created BEFORE the financial core (no transitions / no ledger)
 * their state history and ledger entries, derived ONLY from local data.
 *
 * Guarantees (enforced here and covered by legacy-backfill.db.spec.ts):
 *  - INSERT-only into PaymentStateTransition / FinancialLedgerEntry (+ FinancialDiscrepancy for
 *    findings, + one FinancialAuditEvent summary when something was inserted).
 *  - Never updates Payment / Order / Inventory (not even Payment.financialState); never calls the
 *    payment provider.
 *  - Idempotent: deterministic keys (ledger idempotencyKey, transition (paymentId,eventKey),
 *    discrepancy dedupeKey) + skipDuplicates → a re-run inserts nothing.
 *  - Payments that already have transitions (tracked live by the financial core) get no new
 *    transitions; ledger keys shared with the live recorder prevent double entries.
 *  - Findings are recorded as FinancialDiscrepancy only (no auto-repair).
 */
import { randomUUID } from 'crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { canPaymentTransition, currentPaymentState, type PaymentState } from './payment-state-machine';
import { checkInventory, checkOrder, checkPayment, type DiscrepancyCandidate } from './reconciliation-checks';
import { PENDING_PAYMENT_EXPIRY_GRACE_MS } from '../orders/reservation-expiry-policy';

const money = (n: unknown) => Math.round(Number(n || 0) * 100) / 100;
export const BACKFILL_SOURCE = 'legacy_backfill';

export type LegacyPaymentRow = {
  id: string;
  orderId: string;
  status: string;
  financialState: string | null;
  externalId: string | null;
  amount: number;
  method: string;
  createdAt: Date;
  updatedAt: Date;
  payload: unknown;
};

export type PlannedTransition = { eventKey: string; fromState: PaymentState | null; toState: PaymentState; createdAt: Date; amount: number };
export type PlannedLedger = { idempotencyKey: string; entryType: string; direction: 'CREDIT' | 'DEBIT' | 'NONE'; amount: number; createdAt: Date };

/** State path a legacy row must have walked to reach its current state (each hop allowed by the state machine). */
export function legacyStatePath(state: PaymentState, externalId: string | null): PaymentState[] {
  const initial: PaymentState = externalId ? 'PENDING' : 'CREATED';
  switch (state) {
    case 'CREATED':
    case 'PENDING':
      return [state];
    case 'AUTHORIZED':
    case 'PAID':
    case 'FAILED':
    case 'CANCELLED':
    case 'EXPIRED':
      return [initial, state];
    case 'PARTIALLY_REFUNDED':
    case 'REFUNDED':
    case 'IN_DISPUTE':
    case 'CHARGEBACK_WON':
    case 'CHARGEBACK_LOST':
      return [initial, 'PAID', state];
  }
}

/** Refunded amount observable locally (MP payload snapshot), capped at the payment amount. */
export function localRefundedAmount(p: LegacyPaymentRow, state: PaymentState, completedRefundedAmount: number): number {
  const payload = (p.payload && typeof p.payload === 'object' ? p.payload : {}) as Record<string, any>;
  const candidates = [payload.transaction_amount_refunded, payload.raw?.transaction_amount_refunded, payload.payment?.transaction_amount_refunded];
  const fromPayload = candidates.map(Number).find((n) => Number.isFinite(n) && n > 0);
  let v = fromPayload ?? (completedRefundedAmount > 0 ? completedRefundedAmount : 0);
  if (state === 'REFUNDED' && !(v > 0)) v = Number(p.amount); // legacy refunds were always full
  return money(Math.min(v, Number(p.amount)));
}

/** Pure planner for one payment. */
export function planLegacyPayment(
  p: LegacyPaymentRow,
  ctx: { hasTransitions: boolean; existingLedgerKeys: Set<string>; ledgerRefunded: number; completedRefunds: number },
): { state: PaymentState; transitions: PlannedTransition[]; ledger: PlannedLedger[]; invalidPath?: PaymentState[] } {
  const state = currentPaymentState(p);
  const path = legacyStatePath(state, p.externalId);
  for (let i = 1; i < path.length; i++) {
    if (!canPaymentTransition(path[i - 1], path[i])) return { state, transitions: [], ledger: [], invalidPath: path };
  }
  const amount = money(p.amount);
  // Initial state at createdAt; later hops at updatedAt (approximate), always strictly after createdAt
  // and strictly increasing so the history orders correctly.
  const tFinal = Math.max(p.updatedAt.getTime(), p.createdAt.getTime() + 1);
  const at = (i: number) => (i === 0 ? p.createdAt : new Date(tFinal + (i - 1)));

  const transitions: PlannedTransition[] = ctx.hasTransitions
    ? []
    : path.map((to, i) => ({ eventKey: i === 0 ? 'created' : `backfill:${i}:${to}`, fromState: i === 0 ? null : path[i - 1], toState: to, createdAt: at(i), amount }));

  const ledger: PlannedLedger[] = [];
  const add = (l: PlannedLedger) => { if (!ctx.existingLedgerKeys.has(l.idempotencyKey)) ledger.push(l); };
  add({ idempotencyKey: `PAYMENT_CREATED:${p.id}`, entryType: 'PAYMENT_CREATED', direction: 'NONE', amount, createdAt: at(0) });
  const paidIdx = path.indexOf('PAID');
  if (paidIdx >= 0) add({ idempotencyKey: `PAYMENT_CAPTURED:${p.id}`, entryType: 'PAYMENT_CAPTURED', direction: 'CREDIT', amount, createdAt: at(paidIdx) });
  if (state === 'FAILED' || state === 'CANCELLED' || state === 'EXPIRED') {
    add({ idempotencyKey: `PAYMENT_${state}:${p.id}`, entryType: `PAYMENT_${state}`, direction: 'NONE', amount, createdAt: at(path.length - 1) });
  }
  if (state === 'REFUNDED' || state === 'PARTIALLY_REFUNDED') {
    const refunded = localRefundedAmount(p, state, ctx.completedRefunds);
    const delta = money(refunded - ctx.ledgerRefunded);
    if (delta > 0.009) {
      add({ idempotencyKey: `REFUND_COMPLETED:sync:${p.id}:${Math.round(refunded * 100)}`, entryType: 'REFUND_COMPLETED', direction: 'DEBIT', amount: delta, createdAt: at(path.length - 1) });
    }
  }
  if (state === 'IN_DISPUTE') add({ idempotencyKey: `CHARGEBACK_OPENED:${p.id}`, entryType: 'CHARGEBACK_OPENED', direction: 'NONE', amount, createdAt: at(path.length - 1) });
  return { state, transitions, ledger };
}

export type BackfillSummary = {
  mode: 'dry-run' | 'apply';
  paymentsScanned: number;
  paymentsWithLiveHistory: number;
  byState: Record<string, number>;
  transitions: { planned: number; inserted: number };
  ledger: { planned: number; inserted: number; byType: Record<string, number> };
  discrepancies: { found: number; new: number; inserted: number; byType: Record<string, number>; bySeverity: Record<string, number>; items: { type: string; severity: string; paymentId?: string | null; orderId?: string | null; message: string }[] };
  invalidPaths: { paymentId: string; path: string[] }[];
  auditEventId: string | null;
};

const inc = (m: Record<string, number>, k: string, by = 1) => { m[k] = (m[k] || 0) + by; };

export async function runLegacyBackfill(prisma: PrismaClient, opts: { apply: boolean; now?: Date; actor?: string; backupSha256?: string | null }): Promise<BackfillSummary> {
  const now = opts.now ?? new Date();
  const s: BackfillSummary = {
    mode: opts.apply ? 'apply' : 'dry-run', paymentsScanned: 0, paymentsWithLiveHistory: 0, byState: {},
    transitions: { planned: 0, inserted: 0 }, ledger: { planned: 0, inserted: 0, byType: {} },
    discrepancies: { found: 0, new: 0, inserted: 0, byType: {}, bySeverity: {}, items: [] }, invalidPaths: [], auditEventId: null,
  };
  const payments = await prisma.payment.findMany({ orderBy: { createdAt: 'asc' }, include: { order: true } });
  const found: DiscrepancyCandidate[] = [];

  for (const raw of payments) {
    s.paymentsScanned++;
    const p: LegacyPaymentRow = { id: raw.id, orderId: raw.orderId, status: raw.status, financialState: raw.financialState, externalId: raw.externalId, amount: Number(raw.amount), method: raw.method, createdAt: raw.createdAt, updatedAt: raw.updatedAt, payload: raw.payload };

    const work = async (db: Prisma.TransactionClient | PrismaClient) => {
      const [tCount, ledgerRows, completedRefunds] = await Promise.all([
        db.paymentStateTransition.count({ where: { paymentId: p.id } }),
        db.financialLedgerEntry.findMany({ where: { paymentId: p.id }, select: { idempotencyKey: true, entryType: true, direction: true, amount: true } }),
        db.paymentRefund.aggregate({ where: { paymentId: p.id, status: 'COMPLETED' }, _sum: { amount: true } }),
      ]);
      const ledgerRefunded = money(ledgerRows.filter((r) => r.entryType === 'REFUND_COMPLETED' && r.direction === 'DEBIT').reduce((a, r) => a + Number(r.amount), 0));
      const plan = planLegacyPayment(p, { hasTransitions: tCount > 0, existingLedgerKeys: new Set(ledgerRows.map((r) => r.idempotencyKey)), ledgerRefunded, completedRefunds: money(completedRefunds._sum.amount) });
      return { plan, tCount, ledgerRows };
    };

    let result: Awaited<ReturnType<typeof work>>;
    if (opts.apply) {
      result = await prisma.$transaction(async (tx) => {
        // Row lock only (no write): serializes with the live recorder for this payment.
        await tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "id" = ${p.id} FOR UPDATE`;
        const r = await work(tx);
        if (r.plan.transitions.length) {
          const res = await tx.paymentStateTransition.createMany({
            data: r.plan.transitions.map((t) => ({ id: randomUUID(), paymentId: p.id, orderId: p.orderId, fromState: t.fromState, toState: t.toState, source: BACKFILL_SOURCE, reason: 'Histórico legado derivado do status local (horário aproximado).', eventKey: t.eventKey, amount: t.amount, createdAt: t.createdAt })),
            skipDuplicates: true,
          });
          s.transitions.inserted += res.count;
        }
        if (r.plan.ledger.length) {
          const res = await tx.financialLedgerEntry.createMany({
            data: r.plan.ledger.map((l) => ({ id: randomUUID(), entryType: l.entryType, direction: l.direction, amount: l.amount, paymentId: p.id, orderId: p.orderId, externalId: p.externalId?.slice(0, 80) ?? null, source: BACKFILL_SOURCE, idempotencyKey: l.idempotencyKey, meta: { backfill: true, legacyStatus: p.status }, createdAt: l.createdAt })),
            skipDuplicates: true,
          });
          s.ledger.inserted += res.count;
        }
        return r;
      }, { maxWait: 20_000, timeout: 20_000 });
    } else {
      result = await work(prisma);
    }
    const { plan, tCount, ledgerRows } = result;
    if (tCount > 0) s.paymentsWithLiveHistory++;
    inc(s.byState, plan.state);
    if (plan.invalidPath) {
      s.invalidPaths.push({ paymentId: p.id, path: plan.invalidPath });
      found.push({ type: 'BACKFILL_INVALID_PATH', severity: 'HIGH', dedupeKey: `BACKFILL_INVALID_PATH:${p.id}`, paymentId: p.id, orderId: p.orderId, externalId: p.externalId,
        message: `Histórico legado não representável pela máquina de estados: ${plan.invalidPath.join(' → ')}` });
    }
    s.transitions.planned += plan.transitions.length;
    s.ledger.planned += plan.ledger.length;
    for (const l of plan.ledger) inc(s.ledger.byType, l.entryType);

    // Checks run against the ledger as it is (apply) or would be (dry-run) after this backfill.
    const all = [...ledgerRows.map((r) => ({ entryType: r.entryType, direction: r.direction, amount: Number(r.amount) })), ...(opts.apply ? [] : plan.ledger)];
    const sum = (t: string, d: string) => money(all.filter((r) => r.entryType === t && r.direction === d).reduce((a, r) => a + Number(r.amount), 0));
    const ledgerSnap = opts.apply
      ? await (async () => {
          const rows = await prisma.financialLedgerEntry.findMany({ where: { paymentId: p.id }, select: { entryType: true, direction: true, amount: true } });
          const sm = (t: string, d: string) => money(rows.filter((r) => r.entryType === t && r.direction === d).reduce((a, r) => a + Number(r.amount), 0));
          return { captured: sm('PAYMENT_CAPTURED', 'CREDIT'), refunded: sm('REFUND_COMPLETED', 'DEBIT'), chargebackLost: sm('CHARGEBACK_LOST', 'DEBIT'), hasCapture: rows.some((r) => r.entryType === 'PAYMENT_CAPTURED') };
        })()
      : { captured: sum('PAYMENT_CAPTURED', 'CREDIT'), refunded: sum('REFUND_COMPLETED', 'DEBIT'), chargebackLost: sum('CHARGEBACK_LOST', 'DEBIT'), hasCapture: all.some((r) => r.entryType === 'PAYMENT_CAPTURED') };
    const refunds = await prisma.paymentRefund.findMany({ where: { paymentId: p.id } });
    found.push(...checkPayment({
      payment: { id: p.id, orderId: p.orderId, status: p.status, financialState: p.financialState, externalId: p.externalId, amount: p.amount, method: p.method, updatedAt: p.updatedAt },
      order: raw.order ? { id: raw.order.id, publicId: raw.order.publicId, status: raw.order.status, total: Number(raw.order.total), reservationExpiresAt: raw.order.reservationExpiresAt } : null,
      provider: null,
      ledger: ledgerSnap,
      refunds: refunds.map((r) => ({ id: r.id, status: r.status, amount: Number(r.amount), updatedAt: r.updatedAt })),
      now,
    }));
  }

  // Order-level + global checks (local data only).
  const orders = await prisma.order.findMany({ include: { payments: { select: { id: true, status: true } }, items: { select: { id: true } } } });
  const movements = await prisma.inventoryMovement.findMany({ select: { orderId: true, orderItemId: true, kind: true } });
  for (const o of orders) {
    found.push(...checkOrder({
      order: { id: o.id, publicId: o.publicId, status: o.status, total: Number(o.total), reservationExpiresAt: o.reservationExpiresAt },
      payments: o.payments,
      movements: movements.filter((m) => m.orderId === o.id).map((m) => ({ orderItemId: m.orderItemId, kind: m.kind })),
      itemIds: o.items.map((i) => i.id),
      now,
      expiryGraceMs: PENDING_PAYMENT_EXPIRY_GRACE_MS + 10 * 60_000,
    }));
  }
  const inv = await prisma.$queryRaw<{ productId: string; sku: string; qtyOnHand: number; qtyReserved: number; reservedByOpenOrders: bigint }[]>`
    SELECT i."productId", p."sku", i."qtyOnHand", i."qtyReserved",
      COALESCE((SELECT SUM(oi."qty") FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId"
                WHERE oi."productId" = i."productId" AND o."status" = 'awaiting_payment'::"OrderStatus"), 0) AS "reservedByOpenOrders"
    FROM "Inventory" i JOIN "Product" p ON p."id" = i."productId"`;
  found.push(...checkInventory(inv.map((r) => ({ ...r, reservedByOpenOrders: Number(r.reservedByOpenOrders) }))));
  const dups = await prisma.$queryRaw<{ provider: string; externalId: string; n: bigint }[]>`
    SELECT "provider", "externalId", COUNT(*) AS n FROM "Payment" WHERE "externalId" IS NOT NULL GROUP BY 1, 2 HAVING COUNT(*) > 1`;
  for (const d of dups) {
    found.push({ type: 'DUPLICATE_EXTERNAL_ID', severity: 'CRITICAL', dedupeKey: `DUPLICATE_EXTERNAL_ID:${d.provider}:${d.externalId}`, externalId: d.externalId, message: `${Number(d.n)} pagamentos locais com o mesmo id do provedor.` });
  }

  const uniq = new Map<string, DiscrepancyCandidate>();
  for (const f of found) if (!uniq.has(f.dedupeKey)) uniq.set(f.dedupeKey, f);
  const existing = new Set((await prisma.financialDiscrepancy.findMany({ where: { dedupeKey: { in: [...uniq.keys()] } }, select: { dedupeKey: true } })).map((d) => d.dedupeKey));
  s.discrepancies.found = uniq.size;
  for (const f of uniq.values()) {
    inc(s.discrepancies.byType, f.type);
    inc(s.discrepancies.bySeverity, f.severity);
    s.discrepancies.items.push({ type: f.type, severity: f.severity, paymentId: f.paymentId ?? null, orderId: f.orderId ?? null, message: f.message });
    if (!existing.has(f.dedupeKey)) s.discrepancies.new++;
  }
  if (opts.apply && s.discrepancies.new) {
    const res = await prisma.financialDiscrepancy.createMany({
      data: [...uniq.values()].filter((f) => !existing.has(f.dedupeKey)).map((f) => ({
        id: randomUUID(), type: f.type, severity: f.severity, dedupeKey: f.dedupeKey, message: f.message.slice(0, 500),
        orderId: f.orderId ?? null, paymentId: f.paymentId ?? null, externalId: f.externalId?.slice(0, 80) ?? null,
        expected: f.expected?.slice(0, 200) ?? null, actual: f.actual?.slice(0, 200) ?? null,
        details: { ...(f.details ?? {}), detectedBy: BACKFILL_SOURCE, noAutoRepair: true } as Prisma.InputJsonValue,
      })),
      skipDuplicates: true,
    });
    s.discrepancies.inserted = res.count;
  }
  if (opts.apply && (s.transitions.inserted || s.ledger.inserted || s.discrepancies.inserted)) {
    const ev = await prisma.financialAuditEvent.create({
      data: { action: 'ledger.legacy_backfill', origin: 'system', actorId: null, reason: 'Backfill do histórico legado (somente INSERT, sem alterar status/estoque, sem chamadas ao provedor)',
        meta: { actor: opts.actor ?? 'cli', backupSha256: opts.backupSha256 ?? null, transitionsInserted: s.transitions.inserted, ledgerInserted: s.ledger.inserted, discrepanciesInserted: s.discrepancies.inserted, paymentsScanned: s.paymentsScanned } },
    });
    s.auditEventId = ev.id;
  }
  return s;
}
