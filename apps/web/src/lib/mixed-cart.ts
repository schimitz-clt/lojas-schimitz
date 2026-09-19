/**
 * v2.1: one seller per order. Client helper for checkout / cart UX.
 * Server remains the authority (MARKETPLACE_MIXED_CART on POST /orders).
 */

export const MARKETPLACE_MIXED_CART_CODE = 'MARKETPLACE_MIXED_CART';

export const MARKETPLACE_MIXED_CART_MESSAGE_PT =
  'Seu carrinho tem produtos de mais de um vendedor. Por enquanto só é possível finalizar a compra com itens de um único vendedor. Remova os itens dos outros vendedores para continuar.';

export type MixedCartSeller = { id?: string | null; name?: string | null; slug?: string | null };

export type MixedCartItem = {
  sellerId?: string | null;
  seller?: MixedCartSeller | null;
};

export function uniqueCartSellerIds(items: MixedCartItem[]): string[] {
  const ids = new Set<string>();
  for (const item of items || []) {
    const id = String(item.seller?.id || item.sellerId || '').trim();
    if (id) ids.add(id);
  }
  return [...ids];
}

export function isMixedSellerCart(items: MixedCartItem[], mixedFlag?: boolean): boolean {
  if (mixedFlag === true) return true;
  return uniqueCartSellerIds(items).length > 1;
}

export function mixedCartSellerNames(items: MixedCartItem[]): string[] {
  const map = new Map<string, string>();
  for (const item of items || []) {
    const id = String(item.seller?.id || item.sellerId || '').trim();
    if (!id || map.has(id)) continue;
    map.set(id, item.seller?.name || 'Vendedor');
  }
  return [...map.values()];
}
