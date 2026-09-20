/**
 * Wishlist / Salvos — regras puras (sem Nest/Prisma client).
 * Persistência autenticada usa o model Favorite. Visitante não entra neste módulo.
 */

export type WishlistProductGate = {
  id?: string | null;
  active?: boolean | null;
  seller?: { status?: string | null } | null;
} | null | undefined;

/** Produto que pode aparecer na lista / ser salvo: ativo e vendedor active. */
export function isWishlistCatalogProduct(product: WishlistProductGate): boolean {
  if (!product?.id) return false;
  if (product.active === false) return false;
  const status = product.seller?.status;
  if (status && status !== 'active') return false;
  return true;
}

export function canAddToWishlist(product: WishlistProductGate): boolean {
  return isWishlistCatalogProduct(product);
}

/** IDs already on the server list — guest sync POSTs only the rest. */
export function guestIdsToSync(guestIds: string[], serverIds: string[]): string[] {
  const have = new Set(serverIds.filter(Boolean));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of guestIds) {
    const id = typeof raw === 'string' ? raw.trim() : '';
    if (!id || have.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
