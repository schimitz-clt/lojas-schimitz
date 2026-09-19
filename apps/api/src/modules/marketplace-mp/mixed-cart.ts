import { BadRequestException } from '@nestjs/common';

export const MARKETPLACE_MIXED_CART = 'MARKETPLACE_MIXED_CART';

export const MARKETPLACE_MIXED_CART_MESSAGE_PT =
  'Seu carrinho tem produtos de mais de um vendedor. Por enquanto só é possível finalizar a compra com itens de um único vendedor. Remova os itens dos outros vendedores para continuar.';

export type CartSellerRef = { sellerId?: string | null };

/** Distinct seller ids on cart / order lines (empty / null ignored). */
export function uniqueSellerIds(items: CartSellerRef[]): string[] {
  const ids = new Set<string>();
  for (const item of items || []) {
    const id = String(item?.sellerId || '').trim();
    if (id) ids.add(id);
  }
  return [...ids];
}

export function isMixedSellerCart(items: CartSellerRef[]): boolean {
  return uniqueSellerIds(items).length > 1;
}

/**
 * v2.1 product rule: one seller per order. Always on — not gated by split flags.
 */
export function assertSingleSellerCart(items: CartSellerRef[]): void {
  if (!isMixedSellerCart(items)) return;
  throw new BadRequestException({
    message: MARKETPLACE_MIXED_CART_MESSAGE_PT,
    code: MARKETPLACE_MIXED_CART,
  });
}
