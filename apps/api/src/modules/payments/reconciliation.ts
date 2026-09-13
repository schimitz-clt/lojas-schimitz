/**
 * Pure helpers for PaymentReconciliation reason codes (orphan webhook integrity).
 * Never invents Order/Payment — only classifies why ops must reconcile manually.
 */

export const RECONCILIATION_STATUS_OPEN = 'RECONCILIATION_REQUIRED' as const;

export type ReconciliationReasonCode =
  | 'orphan_approved'
  | 'orphan_paid_status'
  | 'orphan_pending'
  | 'orphan_refused'
  | 'orphan_expired'
  | 'orphan_cancelled'
  | 'orphan_refunded'
  | 'orphan_unknown';

/** Map provider/domain status on an authenticated orphan webhook to a stable reason code. */
export function orphanReconciliationReason(providerStatus: string): ReconciliationReasonCode {
  const s = String(providerStatus || '').toLowerCase().trim();
  if (s === 'approved') return 'orphan_approved';
  if (s === 'paid') return 'orphan_paid_status';
  if (s === 'pending') return 'orphan_pending';
  if (s === 'refused' || s === 'rejected') return 'orphan_refused';
  if (s === 'expired') return 'orphan_expired';
  if (s === 'cancelled' || s === 'canceled') return 'orphan_cancelled';
  if (s === 'refunded') return 'orphan_refunded';
  return 'orphan_unknown';
}

/** True when provider status implies money may have been captured without local Payment. */
export function isOrphanMoneyAtRisk(providerStatus: string): boolean {
  const code = orphanReconciliationReason(providerStatus);
  return code === 'orphan_approved' || code === 'orphan_paid_status';
}
