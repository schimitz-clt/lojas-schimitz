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
  /** Public seller slug (active sellers only). */
  seller?: string;
  sort?: string;
  page?: string;
  pageSize?: string;
};

/** Virtual department: products with a real compare-at above list (home "Ofertas"). */
export const OFFERS_CATEGORY_SLUG = 'ofertas';

export function isOffersCategorySlug(slug?: string | null): boolean {
  const s = String(slug || '').trim().toLowerCase();
  return s === OFFERS_CATEGORY_SLUG || s === 'offers';
}

/** Commercial offer: list price > 0 and compare-at strictly higher. Null/equal/inverted is not an offer. */
export function isRealOfferDeal(price: unknown, compareAt: unknown): boolean {
  const p = toNumericPrice(price);
  const c = toNumericPrice(compareAt);
  return Number.isFinite(p) && p > 0 && Number.isFinite(c) && c > p;
}

/**
 * Prisma where for /departamento/ofertas (portable pre-filter).
 * Column-to-column compareAtPrice > price is applied via offerDealIdWhere().
 */
export function offersCatalogWhere() {
  return {
    AND: [{ compareAtPrice: { not: null } }, { price: { gt: 0 } }],
  };
}

type RawQueryClient = {
  $queryRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<Array<{ id: string }>>;
};

/**
 * IDs whose compare-at is strictly above list price.
 * Runs in Postgres so count/pagination see the same set as the vitrine.
 */
export async function offerDealIds(prisma: RawQueryClient): Promise<string[]> {
  const rows = await prisma.$queryRaw`
    SELECT p.id
    FROM "Product" p
    WHERE p.price > 0
      AND p."compareAtPrice" IS NOT NULL
      AND p."compareAtPrice" > p.price
  `;
  return rows.map((row) => String(row.id));
}

/** Intersect the list where with real deals. Empty catalog → no rows (not a full table scan). */
export function offerDealIdWhere(ids: string[]): { id: { in: string[] } } {
  return { id: { in: ids } };
}

export type ProductOrderBy =
  | { price: 'asc' | 'desc' }
  | { createdAt: 'desc' }
  | { ratingCount: 'desc' }
  | { id: 'asc' };

/** Shape returned by buildProductWhere — explicit so tsc accepts .category / .AND / .OR in specs. */
export type PublicProductWhere = {
  active: true;
  seller: { status: 'active'; slug?: string };
  category?: { slug: string };
  AND?: Array<{ compareAtPrice?: { not: null }; price?: { gt: number } }>;
  price?: { gte?: number; lte?: number };
  OR?: Array<Record<string, unknown>>;
};

export function parsePage(page?: string): number {
  return Math.max(1, Number(page) || 1);
}

export function parsePageSize(pageSize?: string): number {
  return Math.min(60, Math.max(1, Number(pageSize) || 24));
}

/** Page window used by GET /products. pageSize is capped at 60. */
export function catalogListWindow(page?: string, pageSize?: string): {
  page: number;
  pageSize: number;
  skip: number;
} {
  const take = parsePageSize(pageSize);
  const pageNum = parsePage(page);
  return { page: pageNum, pageSize: take, skip: (pageNum - 1) * take };
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

/** Accept a public seller slug (`lojas-schimitz`). Rejects junk / injection-shaped input. */
export function parseSellerSlug(raw?: string): string | undefined {
  const s = (raw || '').trim().toLowerCase();
  if (!s || s.length > 80) return undefined;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)) return undefined;
  return s;
}

/** Prisma-compatible where fragment for public catalog list. */
export function buildProductWhere(input: ProductListQuery): PublicProductWhere {
  const q = (input.q || '').trim();
  const category = (input.category || '').trim();
  const offers = isOffersCategorySlug(category);
  const sellerSlug = parseSellerSlug(input.seller);
  const minPrice = parseMoneyBound(input.minPrice);
  const maxPrice = parseMoneyBound(input.maxPrice);

  // Pass JS numbers; Prisma maps them onto Decimal(12,2) numerically (not as text).
  const priceFilter: { gte?: number; lte?: number } = {};
  if (minPrice != null) priceFilter.gte = minPrice;
  if (maxPrice != null) priceFilter.lte = maxPrice;

  return {
    active: true,
    seller: {
      status: 'active' as const,
      ...(sellerSlug ? { slug: sellerSlug } : {}),
    },
    ...(offers
      ? offersCatalogWhere()
      : category
        ? { category: { slug: category } }
        : {}),
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
