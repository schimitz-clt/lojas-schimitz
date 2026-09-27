/**
 * In-process financial counters (per API replica, reset on restart).
 * The admin health endpoint ALSO returns DB-derived counts, which are the durable truth;
 * these counters only show activity since the process started.
 */
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
] as const;

export type FinanceCounter = (typeof FINANCE_COUNTERS)[number];

const counters = new Map<FinanceCounter, number>();
const startedAt = new Date();

export const financeMetrics = {
  inc(name: FinanceCounter, by = 1) {
    counters.set(name, (counters.get(name) || 0) + by);
  },
  get(name: FinanceCounter) {
    return counters.get(name) || 0;
  },
  snapshot() {
    const out: Record<string, number> = {};
    for (const k of FINANCE_COUNTERS) out[k] = counters.get(k) || 0;
    return { since: startedAt.toISOString(), scope: 'process' as const, counters: out };
  },
  /** Tests only. */
  reset() {
    counters.clear();
  },
};
