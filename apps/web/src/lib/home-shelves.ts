/**
 * Storefront home shelves — parse API rails + client fallback from GET /products.
 * Ranking stays honest: no invented discount %, no fake bestsellers.
 */

import { toNumber } from '@/lib/pricing';

export const HOME_SHELF_LIMIT = 12;

export type HomeShelfId = 'offers' | 'newest' | 'featured';
export type OfferMetric = 'deal' | 'lowest_price';
export type FeaturedMetric = 'paid_qty' | 'rating_count' | 'newest';

export type HomeShelfProductLike = {
  id?: string | null;
  name?: string | null;
  slug?: string | null;
  price?: number | string | null;
  compareAtPrice?: number | string | null;
  badge?: string | null;
  ratingCount?: number | null;
  createdAt?: string | Date | null;
};

export type HomeShelfView<T = HomeShelfProductLike> = {
  id: HomeShelfId;
  title: string;
  subtitle: string;
  href: string;
  linkLabel: string;
  metric: OfferMetric | 'createdAt' | FeaturedMetric;
  items: T[];
};

function asId(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function createdAtMs(value: Date | string | null | undefined): number {
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

/** Real deal: compare-at above list, or an admin/catalog badge. */
export function isOfferProduct(p: HomeShelfProductLike): boolean {
  const price = toNumber(p.price);
  const cmp = toNumber(p.compareAtPrice);
  if (price > 0 && cmp > price) return true;
  return String(p.badge || '').trim().length > 0;
}

export function offerDiscountRatio(p: HomeShelfProductLike): number {
  const price = toNumber(p.price);
  const cmp = toNumber(p.compareAtPrice);
  if (!(price > 0 && cmp > price)) return 0;
  return (cmp - price) / cmp;
}

export function takeShelfItems<T>(items: T[], limit = HOME_SHELF_LIMIT): T[] {
  const cap = Math.max(1, Math.min(HOME_SHELF_LIMIT, Math.floor(Number(limit) || HOME_SHELF_LIMIT)));
  return items.slice(0, cap);
}

export function catalogProductsFromResponse<T extends HomeShelfProductLike>(data: unknown): T[] {
  if (Array.isArray(data)) {
    return data.filter((x) => x && typeof x === 'object' && asId((x as T).id)) as T[];
  }
  if (data && typeof data === 'object') {
    const items = (data as { items?: unknown }).items;
    if (Array.isArray(items)) {
      return items.filter((x) => x && typeof x === 'object' && asId((x as T).id)) as T[];
    }
  }
  return [];
}

export function pickOfferProducts<T extends HomeShelfProductLike>(
  products: T[],
  limit = HOME_SHELF_LIMIT,
): { items: T[]; metric: OfferMetric } {
  const deals = products.filter(isOfferProduct).sort((a, b) => {
    const dr = offerDiscountRatio(b) - offerDiscountRatio(a);
    if (dr !== 0) return dr;
    const pa = toNumber(a.price);
    const pb = toNumber(b.price);
    if (pa !== pb) return pa - pb;
    return asId(a.id).localeCompare(asId(b.id));
  });
  if (deals.length) return { items: takeShelfItems(deals, limit), metric: 'deal' };
  const cheapest = [...products].sort((a, b) => {
    const pa = toNumber(a.price);
    const pb = toNumber(b.price);
    if (pa !== pb) return pa - pb;
    return asId(a.id).localeCompare(asId(b.id));
  });
  return { items: takeShelfItems(cheapest, limit), metric: 'lowest_price' };
}

export function pickNewestProducts<T extends HomeShelfProductLike>(
  products: T[],
  limit = HOME_SHELF_LIMIT,
): T[] {
  const ranked = [...products].sort((a, b) => {
    const dt = createdAtMs(b.createdAt) - createdAtMs(a.createdAt);
    if (dt !== 0) return dt;
    return asId(a.id).localeCompare(asId(b.id));
  });
  return takeShelfItems(ranked, limit);
}

export function pickFeaturedFromCatalog<T extends HomeShelfProductLike>(
  products: T[],
  limit = HOME_SHELF_LIMIT,
): { items: T[]; metric: FeaturedMetric } {
  const withRatings = products.filter((p) => Number(p.ratingCount ?? 0) > 0);
  if (withRatings.length) {
    const ranked = [...withRatings].sort((a, b) => {
      const ra = Number(a.ratingCount ?? 0);
      const rb = Number(b.ratingCount ?? 0);
      if (ra !== rb) return rb - ra;
      const dt = createdAtMs(b.createdAt) - createdAtMs(a.createdAt);
      if (dt !== 0) return dt;
      return asId(a.id).localeCompare(asId(b.id));
    });
    return { items: takeShelfItems(ranked, limit), metric: 'rating_count' };
  }
  return { items: pickNewestProducts(products, limit), metric: 'newest' };
}

export function offersShelfCopy(metric: OfferMetric): Omit<HomeShelfView, 'items'> {
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

export function newestShelfCopy(): Omit<HomeShelfView, 'items'> {
  return {
    id: 'newest',
    title: 'Novidades',
    subtitle: 'Mais recentes por data de cadastro',
    href: '/produtos?sort=newest',
    linkLabel: 'Ver catálogo',
    metric: 'createdAt',
  };
}

export function featuredShelfCopy(metric: FeaturedMetric): Omit<HomeShelfView, 'items'> {
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

/** Client fallback when GET /store/shelves is unavailable — no sales qty here. */
export function shelvesFromCatalog<T extends HomeShelfProductLike>(
  products: T[],
  limit = HOME_SHELF_LIMIT,
): HomeShelfView<T>[] {
  const list = catalogProductsFromResponse<T>(products);
  const offers = pickOfferProducts(list, limit);
  const newest = pickNewestProducts(list, limit);
  const featured = pickFeaturedFromCatalog(list, limit);
  return [
    { ...offersShelfCopy(offers.metric), items: offers.items },
    { ...newestShelfCopy(), items: newest },
    { ...featuredShelfCopy(featured.metric), items: featured.items },
  ];
}

export function parseHomeShelvesPayload<T extends HomeShelfProductLike>(data: unknown): HomeShelfView<T>[] | null {
  if (!data || typeof data !== 'object') return null;
  const raw = (data as { shelves?: unknown }).shelves;
  if (!Array.isArray(raw)) return null;
  const out: HomeShelfView<T>[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Partial<HomeShelfView<T>>;
    const id = r.id;
    if (id !== 'offers' && id !== 'newest' && id !== 'featured') continue;
    const items = catalogProductsFromResponse<T>(r.items);
    out.push({
      id,
      title: String(r.title || '').trim() || fallbackTitle(id, r.metric),
      subtitle: String(r.subtitle || '').trim(),
      href: String(r.href || '').trim() || fallbackHref(id),
      linkLabel: String(r.linkLabel || '').trim() || 'Ver catálogo',
      metric: (r.metric as HomeShelfView['metric']) || fallbackMetric(id),
      items,
    });
  }
  return out;
}

function fallbackTitle(id: HomeShelfId, metric?: HomeShelfView['metric']): string {
  if (id === 'offers') return 'Ofertas';
  if (id === 'newest') return 'Novidades';
  if (metric === 'newest') return 'Em destaque';
  return 'Mais vendidos';
}

function fallbackHref(id: HomeShelfId): string {
  if (id === 'offers') return '/departamento/ofertas';
  if (id === 'newest') return '/produtos?sort=newest';
  return '/produtos?sort=relevance';
}

function fallbackMetric(id: HomeShelfId): HomeShelfView['metric'] {
  if (id === 'offers') return 'deal';
  if (id === 'newest') return 'createdAt';
  return 'rating_count';
}

export function visibleHomeShelves<T extends { items: unknown[] }>(shelves: T[] | null | undefined): T[] {
  return (shelves || []).filter((s) => Array.isArray(s.items) && s.items.length > 0);
}

export function homeShelfNavPrevLabel(): string {
  return 'Ver produtos anteriores';
}

export function homeShelfNavNextLabel(): string {
  return 'Ver próximos produtos';
}

export function homeShelfScrollAmount(railWidth: number): number {
  const w = Number(railWidth);
  if (!Number.isFinite(w) || w <= 0) return 220;
  return Math.max(180, Math.round(w * 0.72));
}
