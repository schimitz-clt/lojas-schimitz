/**
 * Marketplace hub copy + seller directory helpers.
 * Keep claims aligned with what ships: gated MP split, no per-seller freight.
 */

export type PublicSellerCard = {
  id: string;
  name: string;
  slug: string;
  productCount?: number;
};

export const MARKETPLACE_V1_NOT_BUILT = [
  'vários vendedores no mesmo pedido',
  'frete por vendedor',
  'chargeback por vendedor',
] as const;

export const MARKETPLACE_PHASE1_NOTE =
  'Fase 1: vendedores parceiros podem conectar Mercado Pago (OAuth) quando MP_MARKETPLACE_SPLIT_ENABLED=true. Carrinho com mais de um vendedor é bloqueado no checkout. A loja própria (lojas-schimitz) não faz self-split.';

export const MARKETPLACE_PHASE2_NOTE =
  'Fase 2 (sandbox): com ENABLED=true, ALLOW_LIVE=false e credenciais de teste (TEST- ou APP_USR de staging), o checkout de um vendedor vinculado envia application_fee no token do seller. PIX 5% é absorvido pela plataforma no cálculo da fee. Produção sem ALLOW_LIVE continua no collector da loja.';

export const MARKETPLACE_PHASE3_NOTE =
  'Fase 3 (código): split live com application_fee só quando ENABLED=true, ALLOW_LIVE=true, produção e credenciais APP_USR. Sem essas flags, produção continua fail-closed. PIX live que o MP recusar fee cai em ledger_only (QR na plataforma; vendedor pago via ledger). Rollback: ALLOW_LIVE=false. Ligar no Railway exige segundo OK de deploy + flip de env pela ops.';

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

export function marketplaceEmptySellersCopy(): { title: string; body: string } {
  return {
    title: 'Nenhum vendedor ativo no momento',
    body: 'Quando houver parceiros com anúncios, eles aparecem aqui. Não listamos lojas fictícias. O catálogo da Lojas Schimitz continua em Produtos.',
  };
}

/** Honest count. Zero is an empty shelf, not “0 produto(s)”. */
export function sellerProductCountLabel(count: number | null | undefined): string | null {
  if (count == null || !Number.isFinite(count)) return null;
  if (count <= 0) return 'Sem anúncios no momento';
  if (count === 1) return '1 produto';
  return `${count.toLocaleString('pt-BR')} produtos`;
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
