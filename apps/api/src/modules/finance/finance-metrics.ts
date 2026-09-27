/**
 * Financial-core counters.
 *  - `snapshot()` = in-process view (per replica, since start) — unchanged, kept for compatibility.
 *  - Every increment is ALSO queued as a delta for its America/Sao_Paulo calendar day; the
 *    FinanceMetricsStore flushes those deltas to Postgres (FinanceMetricCounter) with atomic
 *    `value = value + delta` upserts, so counters survive restarts and add up across replicas.
 * inc() stays synchronous and never throws/blocks the financial flow (no DB call on the hot path).
 */
import { opsSignals } from '../../common/sliding-window';

export const FINANCE_COUNTERS = [
  'payments_created',
  'payments_paid',
  'payments_failed',
  'payments_pending',
  'payments_expired',
  'payments_cancelled',
  'refunds_requested',
  'refunds_completed',
  'refunds_failed',
  'chargebacks_opened',
  'chargebacks_resolved',
  'discrepancies_created',
  'webhook_received',
  'webhook_duplicates',
  'webhook_failures',
  'webhook_ignored_topic',
  'provider_errors',
  'forbidden_transitions',
  'finance_hook_failures',
  'reconciliation_runs',
  'ledger_adjustments',
  // Webhook classification (additive): unsigned legacy IPN acknowledged without processing;
  // unsigned non-IPN requests rejected with 401; failures while processing an authenticated event
  // (chargeback handler / provider fetch / apply). `webhook_failures` = processing failures +
  // claimed-but-invalid signatures + missing secret + unparseable events.
  'webhook_unsigned_ipn',
  'webhook_unsigned_rejected',
  'webhook_processing_failures',
] as const;

export type FinanceCounter = (typeof FINANCE_COUNTERS)[number];

/** Counters mirrored into the ops sliding window (burst alerts + payments health). */
const OPS_SIGNAL_COUNTERS = new Set<FinanceCounter>([
  'provider_errors',
  'webhook_failures',
  'webhook_processing_failures',
  'payments_failed',
  'payments_paid',
  'payments_created',
]);

const counters = new Map<FinanceCounter, number>();
const startedAt = new Date();
/** Deltas not yet persisted, keyed by `${YYYY-MM-DD}|${counter}` (day = America/Sao_Paulo). */
const pending = new Map<string, number>();

/** Calendar day in America/Sao_Paulo (UTC-3, no DST since 2019) as YYYY-MM-DD. */
export function saoPauloDay(now = new Date()): string {
  return new Date(now.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
}

export type PendingDelta = { day: string; name: FinanceCounter; delta: number };

export const financeMetrics = {
  inc(name: FinanceCounter, by = 1) {
    if (!Number.isFinite(by) || by === 0) return;
    counters.set(name, (counters.get(name) || 0) + by);
    const key = `${saoPauloDay()}|${name}`;
    pending.set(key, (pending.get(key) || 0) + by);
    // H4: recent-window signal for ops alerts / GET /health/payments (in-memory, never throws)
    if (by > 0 && OPS_SIGNAL_COUNTERS.has(name)) {
      try {
        for (let i = 0; i < Math.min(by, 100); i++) opsSignals.record(name);
      } catch {
        /* ignore */
      }
    }
  },
  /** Take all unpersisted deltas (the caller must persist them or give them back with requeue). */
  drainPending(): PendingDelta[] {
    const out: PendingDelta[] = [];
    for (const [key, delta] of pending) {
      const [day, name] = key.split('|') as [string, FinanceCounter];
      out.push({ day, name, delta });
    }
    pending.clear();
    return out;
  },
  /** Give back deltas whose flush failed (merged with anything incremented meanwhile). */
  requeue(deltas: PendingDelta[]) {
    for (const d of deltas) {
      const key = `${d.day}|${d.name}`;
      pending.set(key, (pending.get(key) || 0) + d.delta);
    }
  },
  /** Unpersisted deltas without draining (for read-your-writes in the admin view). */
  peekPending(): PendingDelta[] {
    return Array.from(pending, ([key, delta]) => {
      const [day, name] = key.split('|') as [string, FinanceCounter];
      return { day, name, delta };
    });
  },
  get(name: FinanceCounter) {
    return counters.get(name) || 0;
  },
  snapshot() {
    const out: Record<string, number> = {};
    for (const k of FINANCE_COUNTERS) out[k] = counters.get(k) || 0;
    return { since: startedAt.toISOString(), scope: 'process' as const, counters: out };
  },
  /** Tests only (simulates a fresh process: in-memory counters AND unflushed deltas are lost). */
  reset() {
    counters.clear();
    pending.clear();
  },
};
