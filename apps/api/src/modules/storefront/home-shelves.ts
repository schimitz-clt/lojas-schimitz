/**
 * Home product shelves (Magalu-style rails) — ranking + honest PT-BR copy.
 * Pure: no Nest/Prisma client. Sales qty is supplied by the caller.
 *
 * Semantics (do not invent discount % or fake bestsellers):
 * - Ofertas: compareAtPrice > price and/or catalog badge; else cheapest actives.
 * - Novidades: newest by createdAt.
 * - Mais vendidos: paid-order qty when present; else ratingCount; else
 *   newest labeled "Em destaque" (not "Mais vendidos").
 */

import { toNumericPrice } from '../catalog/catalog.query';

export const HOME_SHELF_LIMIT = 12;

export const HOME_SHELF_IDS = ['offers', 'newest', 'featured'] as const;
export type HomeShelfId = (typeof HOME_SHELF_IDS)[number];

export type OfferMetric = 'deal' | 'lowest_price';
export type FeaturedMetric = 'paid_qty' | 'rating_count' | 'newest';

export type ShelfProductLike = {
  id: string;
  price?: unknown;
  compareAtPrice?: unknown;
  badge?: string | null;
  ratingCount?: number | null;
  createdAt?: Date | string | null;
};

export type HomeShelfCopy = {
  id: HomeShelfId;
  title: string;
  subtitle: string;
  href: string;
  linkLabel: string;
  metric: OfferMetric | 'createdAt' | FeaturedMetric;
};

export type SoldQtyRow = {
  productId: string;
  qty: number;
};

export function soldQtyMap(rows: SoldQtyRow[] | null | undefined): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows || []) {
    const id = String(row?.productId || '').trim();
    const qty = Number(row?.qty);
    if (!id || !Number.isFinite(qty) || qty <= 0) continue;
    map.set(id, (map.get(id) || 0) + qty);
  }
  return map;
}

export function hasSoldQty(map: Map<string, number>): boolean {
  for (const qty of map.values()) {
    if (qty > 0) return true;
  }
  return false;
}

/** Real deal: compare-at above list, or an admin/catalog badge. No invented %. */
export function isOfferProduct(p: ShelfProductLike): boolean {
  const price = toNumericPrice(p.price);
  const cmp = toNumericPrice(p.compareAtPrice);
  if (Number.isFinite(price) && price > 0 && Number.isFinite(cmp) && cmp > price) {
    return true;
  }
  return String(p.badge || '').trim().length > 0;
}

export function offerDiscountRatio(p: ShelfProductLike): number {
  const price = toNumericPrice(p.price);
  const cmp = toNumericPrice(p.compareAtPrice);
  if (!(Number.isFinite(price) && price > 0 && Number.isFinite(cmp) && cmp > price)) return 0;
  return (cmp - price) / cmp;
}

function byId(a: ShelfProductLike, b: ShelfProductLike): number {
  return String(a.id).localeCompare(String(b.id));
}

export function createdAtMs(value: Date | string | null | undefined): number {
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isFinite(t) ? t : 0;
  }
  if (typeof value === 'string' && value.trim()) {
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : 0;
  }
  return 0;
}

export function takeShelfItems<T>(items: T[], limit = HOME_SHELF_LIMIT): T[] {
  const cap = Math.max(1, Math.min(HOME_SHELF_LIMIT, Math.floor(Number(limit) || HOME_SHELF_LIMIT)));
  return items.slice(0, cap);
}

export function pickOfferProducts<T extends ShelfProductLike>(
  products: T[],
  limit = HOME_SHELF_LIMIT,
): { items: T[]; metric: OfferMetric } {
  const deals = products.filter(isOfferProduct).sort((a, b) => {
    const dr = offerDiscountRatio(b) - offerDiscountRatio(a);
    if (dr !== 0) return dr;
    const pa = toNumericPrice(a.price);
    const pb = toNumericPrice(b.price);
    if (Number.isFinite(pa) && Number.isFinite(pb) && pa !== pb) return pa - pb;
    return byId(a, b);
  });
  if (deals.length) return { items: takeShelfItems(deals, limit), metric: 'deal' };

  const cheapest = [...products].sort((a, b) => {
    const pa = toNumericPrice(a.price);
    const pb = toNumericPrice(b.price);
    const fa = Number.isFinite(pa);
    const fb = Number.isFinite(pb);
    if (fa && fb && pa !== pb) return pa - pb;
    if (fa !== fb) return fa ? -1 : 1;
    return byId(a, b);
  });
  return { items: takeShelfItems(cheapest, limit), metric: 'lowest_price' };
}

export function pickNewestProducts<T extends ShelfProductLike>(
  products: T[],
  limit = HOME_SHELF_LIMIT,
): T[] {
  const ranked = [...products].sort((a, b) => {
    const dt = createdAtMs(b.createdAt) - createdAtMs(a.createdAt);
    if (dt !== 0) return dt;
    return byId(a, b);
  });
  return takeShelfItems(ranked, limit);
}

export function pickFeaturedProducts<T extends ShelfProductLike>(
  products: T[],
  sold: Map<string, number>,
  limit = HOME_SHELF_LIMIT,
): { items: T[]; metric: FeaturedMetric } {
  if (hasSoldQty(sold)) {
    const ranked = [...products].sort((a, b) => {
      const sa = sold.get(a.id) || 0;
      const sb = sold.get(b.id) || 0;
      if (sa !== sb) return sb - sa;
      const ra = Number(a.ratingCount ?? 0);
      const rb = Number(b.ratingCount ?? 0);
      if (ra !== rb) return rb - ra;
      return byId(a, b);
    });
    const withSales = ranked.filter((p) => (sold.get(p.id) || 0) > 0);
    if (withSales.length) {
      return { items: takeShelfItems(withSales, limit), metric: 'paid_qty' };
    }
  }

  const withRatings = products.filter((p) => Number(p.ratingCount ?? 0) > 0);
  if (withRatings.length) {
    const ranked = [...withRatings].sort((a, b) => {
      const ra = Number(a.ratingCount ?? 0);
      const rb = Number(b.ratingCount ?? 0);
      if (ra !== rb) return rb - ra;
      const dt = createdAtMs(b.createdAt) - createdAtMs(a.createdAt);
      if (dt !== 0) return dt;
      return byId(a, b);
    });
    return { items: takeShelfItems(ranked, limit), metric: 'rating_count' };
  }

  return { items: pickNewestProducts(products, limit), metric: 'newest' };
}

export function offersShelfCopy(metric: OfferMetric): HomeShelfCopy {
  if (metric === 'deal') {
    return {
      id: 'offers',
      title: 'Ofertas',
      subtitle: 'Preço menor que o de → ou selo do catálogo',
      href: '/departamento/ofertas',
      linkLabel: 'Ver todas',
      metric: 'deal',
    };
  }
  return {
    id: 'offers',
    title: 'Ofertas',
    subtitle: 'Menores preços do catálogo',
    href: '/departamento/ofertas',
    linkLabel: 'Ver todas',
    metric: 'lowest_price',
  };
}

export function newestShelfCopy(): HomeShelfCopy {
  return {
    id: 'newest',
    title: 'Novidades',
    subtitle: 'Mais recentes por data de cadastro',
    href: '/produtos?sort=newest',
    linkLabel: 'Ver catálogo',
    metric: 'createdAt',
  };
}

export function featuredShelfCopy(metric: FeaturedMetric): HomeShelfCopy {
  if (metric === 'paid_qty') {
    return {
      id: 'featured',
      title: 'Mais vendidos',
      subtitle: 'Quantidade em pedidos pagos',
      href: '/produtos?sort=relevance',
      linkLabel: 'Ver catálogo',
      metric: 'paid_qty',
    };
  }
  if (metric === 'rating_count') {
    return {
      id: 'featured',
      title: 'Mais vendidos',
      subtitle: 'Ainda sem volume de pedidos — ordenado por avaliações publicadas',
      href: '/produtos?sort=relevance',
      linkLabel: 'Ver catálogo',
      metric: 'rating_count',
    };
  }
  return {
    id: 'featured',
    title: 'Em destaque',
    subtitle: 'Destaques recentes do catálogo',
    href: '/produtos?sort=newest',
    linkLabel: 'Ver catálogo',
    metric: 'newest',
  };
}

export type AssembledShelf<T> = HomeShelfCopy & { items: T[] };

export function assembleHomeShelves<T extends ShelfProductLike>(
  products: T[],
  soldRows: SoldQtyRow[] | null | undefined,
  limit = HOME_SHELF_LIMIT,
): AssembledShelf<T>[] {
  const sold = soldQtyMap(soldRows);
  const offers = pickOfferProducts(products, limit);
  const newest = pickNewestProducts(products, limit);
  const featured = pickFeaturedProducts(products, sold, limit);
  return [
    { ...offersShelfCopy(offers.metric), items: offers.items },
    { ...newestShelfCopy(), items: newest },
    { ...featuredShelfCopy(featured.metric), items: featured.items },
  ];
}

/** Empty rails stay hidden on the storefront. */
export function visibleHomeShelves<T extends { items: unknown[] }>(shelves: T[]): T[] {
  return (shelves || []).filter((s) => Array.isArray(s.items) && s.items.length > 0);
}
