/**
 * Marketplace hub copy + seller directory helpers.
 * Keep claims aligned with what v1 actually ships (no MP split, no per-seller freight).
 */

export type PublicSellerCard = {
  id: string;
  name: string;
  slug: string;
  productCount?: number;
};

export const MARKETPLACE_V1_NOT_BUILT = [
  'split automático do Mercado Pago',
  'OAuth de vendedores',
  'frete por vendedor',
  'chargeback por vendedor',
] as const;

export function uniqueSellersFromProducts(
  items: Array<{ seller?: { id?: string; name?: string; slug?: string } | null }>,
): PublicSellerCard[] {
  const map = new Map<string, PublicSellerCard>();
  for (const item of items) {
    const s = item.seller;
    if (!s?.id || !s.name || !s.slug) continue;
    const prev = map.get(s.id);
    map.set(s.id, {
      id: s.id,
      name: s.name,
      slug: s.slug,
      productCount: (prev?.productCount || 0) + 1,
    });
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export function isHouseBrandOnly(sellers: PublicSellerCard[]): boolean {
  return sellers.length === 1 && sellers[0]?.slug === 'lojas-schimitz';
}

export function marketplaceSellersHeading(sellers: PublicSellerCard[]): string {
  if (!sellers.length) return 'Vendedores';
  if (isHouseBrandOnly(sellers)) return 'Vendedor atual';
  return 'Vendedores ativos';
}

export function marketplaceIntro(sellers: PublicSellerCard[]): string {
  if (isHouseBrandOnly(sellers)) {
    return 'Hoje o catálogo público é vendido pela Lojas Schimitz (loja própria). Cada anúncio mostra Vendido por na listagem e na página do produto.';
  }
  if (!sellers.length) {
    return 'O checkout, o frete e o pagamento continuam unificados na Lojas Schimitz. Cada anúncio mostra quem vende.';
  }
  return 'Produtos podem ser da loja própria ou de vendedores ativos. Cada anúncio mostra Vendido por. Checkout, frete e pagamento continuam unificados.';
}

export function normalizePublicSellers(raw: unknown): PublicSellerCard[] {
  if (!Array.isArray(raw)) return [];
  const out: PublicSellerCard[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const id = typeof r.id === 'string' ? r.id : '';
    const name = typeof r.name === 'string' ? r.name : '';
    const slug = typeof r.slug === 'string' ? r.slug : '';
    if (!id || !name || !slug) continue;
    const productCount = typeof r.productCount === 'number' ? r.productCount : undefined;
    out.push({ id, name, slug, productCount });
  }
  return out;
}
