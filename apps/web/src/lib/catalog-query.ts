import { parseCatalogSort } from '@/lib/storefront-pro';
import { CATALOG_PAGE_SIZE, parseCatalogPage } from '@/lib/catalog-pagination';

type Get = (key: string) => string | null | undefined;

/** Same /products query for the server render and the client, so the server seed can be reused as-is. */
export function catalogQueryPath(get: Get): string {
  const q = get('q') || '';
  const category = get('category') || '';
  const seller = (get('seller') || '').trim().toLowerCase();
  const minPrice = get('minPrice') || '';
  const maxPrice = get('maxPrice') || '';
  const sort = parseCatalogSort(get('sort') ?? null);
  const page = parseCatalogPage(get('page') ?? null);
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (category) params.set('category', category);
  if (minPrice) params.set('minPrice', minPrice);
  if (maxPrice) params.set('maxPrice', maxPrice);
  if (sort && sort !== 'relevance') params.set('sort', sort);
  if (seller) params.set('seller', seller);
  params.set('page', String(page));
  params.set('pageSize', String(CATALOG_PAGE_SIZE));
  return `/products?${params.toString()}`;
}

export type CatalogSeed<P, C> = { path: string; items: P[]; total: number; categories: C[] | null };

/** API body (envelope or raw) → items/total; null when the shape is unknown. */
export function unwrapCatalogList<P>(body: unknown): { items: P[]; total: number } | null {
  const data = body && typeof body === 'object' && 'data' in (body as object) ? (body as { data: unknown }).data : body;
  if (Array.isArray(data)) return { items: data as P[], total: data.length };
  if (data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)) {
    const items = (data as { items: P[] }).items;
    const total = (data as { total?: number }).total;
    return { items, total: typeof total === 'number' ? total : items.length };
  }
  return null;
}
