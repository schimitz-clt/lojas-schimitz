/**
 * Pure helpers for public GET /products query params.
 * Kept free of Nest/Prisma client so unit tests stay fast.
 *
 * Price is Prisma Decimal(12,2) / Postgres NUMERIC — ORDER BY is numeric.
 * Never sort prices as strings (lexical "10" < "2").
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

export type ProductOrderBy =
  | { price: 'asc' | 'desc' }
  | { createdAt: 'desc' }
  | { ratingCount: 'desc' }
  | { id: 'asc' };

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

/** Parse money query bound; rounds to cents for Decimal(12,2). */
export function parseMoneyBound(raw?: string): number | undefined {
  if (raw == null || String(raw).trim() === '') return undefined;
  const n = Number(String(raw).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return undefined;
  // Avoid float noise before Prisma maps to Decimal(12,2).
  return Math.round(n * 100) / 100;
}

/**
 * Coerce Prisma.Decimal | string | number to a finite number.
 * Used by tests / any in-memory checks — mirrors numeric ORDER BY semantics.
 */
export function toNumericPrice(price: unknown): number {
  if (price == null) return Number.NaN;
  if (typeof price === 'number') return price;
  if (typeof price === 'bigint') return Number(price);
  if (typeof price === 'object') {
    const d = price as { toNumber?: () => number };
    if (typeof d.toNumber === 'function') {
      try {
        return d.toNumber();
      } catch {
        /* fall through */
      }
    }
  }
  return Number(String(price).replace(',', '.'));
}

/**
 * In-memory numeric price sort (same semantics as Prisma orderBy on Decimal).
 * Catches accidental lexical string sorts in tests (e.g. "10" before "2").
 */
export function sortProductsByNumericPrice<T extends { price: unknown }>(
  items: T[],
  direction: 'asc' | 'desc',
): T[] {
  const dir = direction === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    const da = toNumericPrice(a.price);
    const db = toNumericPrice(b.price);
    if (Object.is(da, db)) return 0;
    if (!Number.isFinite(da)) return 1;
    if (!Number.isFinite(db)) return -1;
    if (da < db) return -1 * dir;
    if (da > db) return 1 * dir;
    return 0;
  });
}

/** Prisma-compatible where fragment for public catalog list. */
export function buildProductWhere(input: ProductListQuery) {
  const q = (input.q || '').trim();
  const category = (input.category || '').trim();
  const minPrice = parseMoneyBound(input.minPrice);
  const maxPrice = parseMoneyBound(input.maxPrice);

  // Pass JS numbers; Prisma maps them onto Decimal(12,2) numerically (not as text).
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

/**
 * Prisma orderBy for catalog list.
 * Always an array so findMany gets a stable ORDER BY (price is Decimal/NUMERIC).
 */
export function buildProductOrderBy(sort: ProductSort): ProductOrderBy[] {
  switch (sort) {
    case 'price_asc':
      return [{ price: 'asc' }, { id: 'asc' }];
    case 'price_desc':
      return [{ price: 'desc' }, { id: 'asc' }];
    case 'newest':
      return [{ createdAt: 'desc' }, { id: 'asc' }];
    case 'relevance':
    default:
      // Without full-text ranking: prefer more-reviewed, then newest.
      return [{ ratingCount: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }];
  }
}
