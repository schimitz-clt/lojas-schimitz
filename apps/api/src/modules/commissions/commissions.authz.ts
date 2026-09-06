/**
 * Pure authz helpers for commission ledger visibility (seller portal).
 * Sellers may only read rows where commission.sellerId matches their seller.
 */

export function sellerOwnsCommission(
  sellerId: string,
  commissionSellerId: string | null | undefined,
): boolean {
  if (!sellerId || !commissionSellerId) return false;
  return sellerId === commissionSellerId;
}

export function assertSellerCanViewCommission(
  sellerId: string,
  commissionSellerId: string | null | undefined,
): { ok: true } | { ok: false; code: 'FORBIDDEN_OTHER_SELLER_COMMISSION' } {
  if (sellerOwnsCommission(sellerId, commissionSellerId)) return { ok: true };
  return { ok: false, code: 'FORBIDDEN_OTHER_SELLER_COMMISSION' };
}

/** Filter helper: keep only commissions owned by sellerId. */
export function filterOwnCommissions<T extends { sellerId: string }>(
  sellerId: string,
  rows: T[],
): T[] {
  return rows.filter((r) => sellerOwnsCommission(sellerId, r.sellerId));
}
