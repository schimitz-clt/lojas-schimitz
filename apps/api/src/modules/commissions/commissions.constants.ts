/** Default platform commission % when Seller.commissionPercent is null. */
export const DEFAULT_COMMISSION_PERCENT = 10;

export const COMMISSION_STATUSES = ['pending', 'approved', 'paid', 'cancelled'] as const;
export type CommissionStatusValue = (typeof COMMISSION_STATUSES)[number];

/** Allowed Repasse v1 transitions (manual PIX ledger — no MP split). */
export const COMMISSION_TRANSITIONS: Record<CommissionStatusValue, CommissionStatusValue[]> = {
  pending: ['approved', 'paid', 'cancelled'],
  approved: ['paid', 'cancelled'],
  paid: [],
  cancelled: [],
};

export function canTransitionCommission(
  from: string,
  to: string,
): boolean {
  const allowed = COMMISSION_TRANSITIONS[from as CommissionStatusValue];
  if (!allowed) return false;
  return allowed.includes(to as CommissionStatusValue);
}

/** amount = itemTotal * percent / 100, rounded to 2 decimals. */
export function commissionAmount(itemTotal: number, percent: number): number {
  if (itemTotal <= 0 || percent <= 0) return 0;
  return Math.round((itemTotal * percent) / 100 * 100 + Number.EPSILON) / 100;
}

export function resolveCommissionPercent(sellerPercent: number | null | undefined): number {
  if (sellerPercent == null || Number.isNaN(Number(sellerPercent))) {
    return DEFAULT_COMMISSION_PERCENT;
  }
  const n = Number(sellerPercent);
  if (n < 0) return 0;
  return n;
}
