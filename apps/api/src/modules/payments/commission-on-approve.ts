/**
 * When to write CommissionLedger after a payment is approved.
 * recordOnPaid is idempotent (unique orderItemId) — safe to retry.
 */

export function shouldRecordCommissionOnApprove(input: {
  casWon: boolean;
  orderStatus?: string | null;
}): boolean {
  if (input.casWon) return true;
  return input.orderStatus === 'paid';
}
