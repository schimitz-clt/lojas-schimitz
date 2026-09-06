/**
 * Pure authz helpers for seller portal (no Nest DI).
 * Seller may only mutate products belonging to their sellerId.
 */

export function sellerOwnsProduct(
  sellerId: string,
  productSellerId: string | null | undefined,
): boolean {
  if (!sellerId || !productSellerId) return false;
  return sellerId === productSellerId;
}

export function assertSellerCanUpdateProduct(
  sellerId: string,
  productSellerId: string | null | undefined,
): { ok: true } | { ok: false; code: 'FORBIDDEN_OTHER_SELLER' } {
  if (sellerOwnsProduct(sellerId, productSellerId)) return { ok: true };
  return { ok: false, code: 'FORBIDDEN_OTHER_SELLER' };
}

/** Order item is visible to seller if snapshot sellerId matches (or product seller). */
export function sellerOwnsOrderItem(
  sellerId: string,
  item: { sellerId?: string | null; productSellerId?: string | null },
): boolean {
  const sid = item.sellerId || item.productSellerId;
  return Boolean(sid && sid === sellerId);
}
