/**
 * Pure helpers for public GET /products query params.
 * Kept free of Nest/Prisma client so unit tests stay fast.
 */

export type ProductSort = 'relevance' | 'price_asc' | 'price_desc' | 'newest';

export type ProductListQuery = {
  q?: string;
  category?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
  page?: string;
  pageSize?: string;
};

export function parsePage(page?: string): number {
  return Math.max(1, Number(page) || 1);
}

export function parsePageSize(pageSize?: string): number {
  return Math.min(60, Math.max(1, Number(pageSize) || 24));
}

export function parseSort(sort?: string): ProductSort {
  const s = (sort || 'relevance').trim().toLowerCase();
  if (s === 'price_asc' || s === 'price_desc' || s === 'newest' || s === 'relevance') return s;
  return 'relevance';
}

export function parseMoneyBound(raw?: string): number | undefined {
  if (raw == null || String(raw).trim() === '') return undefined;
  const n = Number(String(raw).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

/** Prisma-compatible where fragment for public catalog list. */
export function buildProductWhere(input: ProductListQuery) {
  const q = (input.q || '').trim();
  const category = (input.category || '').trim();
  const minPrice = parseMoneyBound(input.minPrice);
  const maxPrice = parseMoneyBound(input.maxPrice);

  const priceFilter: { gte?: number; lte?: number } = {};
  if (minPrice != null) priceFilter.gte = minPrice;
  if (maxPrice != null) priceFilter.lte = maxPrice;

  return {
    active: true,
    ...(category ? { category: { slug: category } } : {}),
    ...(Object.keys(priceFilter).length ? { price: priceFilter } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' as const } },
            { description: { contains: q, mode: 'insensitive' as const } },
            { sku: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
}

/** Prisma orderBy for catalog list. */
export function buildProductOrderBy(sort: ProductSort):
  | { createdAt: 'desc' }
  | { price: 'asc' }
  | { price: 'desc' }
  | Array<{ ratingCount: 'desc' } | { createdAt: 'desc' }> {
  switch (sort) {
    case 'price_asc':
      return { price: 'asc' };
    case 'price_desc':
      return { price: 'desc' };
    case 'newest':
      return { createdAt: 'desc' };
    case 'relevance':
    default:
      // Without full-text ranking: prefer more-reviewed, then newest.
      return [{ ratingCount: 'desc' }, { createdAt: 'desc' }];
  }
}
