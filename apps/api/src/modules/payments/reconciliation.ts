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

/**
 * Provider amount/reference does not match the local Payment/Order.
 * These do not self-heal on an identical retry; admin must see a queue row.
 */
export const INTEGRITY_MISMATCH_REASONS = ['amount_mismatch', 'reference_mismatch'] as const;

export type IntegrityMismatchReason = (typeof INTEGRITY_MISMATCH_REASONS)[number];

export function isIntegrityMismatchReason(reason: string): reason is IntegrityMismatchReason {
  return (INTEGRITY_MISMATCH_REASONS as readonly string[]).includes(reason);
}

export type WebhookEventPersistence = {
  /**
   * Persist PaymentEvent.applied=true only when the domain applied the provider
   * status onto Payment/Order. Otherwise a duplicate x-request-id must retry.
   */
  markEventApplied: boolean;
  /** Open/update PaymentReconciliation (admin queue) without pretending the event applied. */
  openReconciliation: boolean;
  reason: string;
};

/**
 * Map applyProviderStatus outcome → PaymentEvent.applied + reconciliation.
 * applied:true (approved, already_paid, refused, …) marks the event.
 * amount/reference mismatch stays applied=false AND opens reconciliation.
 * Other non-applied outcomes (still_pending, not_pending, …) stay applied=false
 * so the same provider event id can be retried; they do not flood the admin queue.
 */
export function decideWebhookEventPersistence(apply: {
  applied: boolean;
  reason?: string;
}): WebhookEventPersistence {
  const reason = String(apply?.reason || 'noop');
  if (apply?.applied === true) {
    return { markEventApplied: true, openReconciliation: false, reason };
  }
  return {
    markEventApplied: false,
    openReconciliation: isIntegrityMismatchReason(reason),
    reason,
  };
}
