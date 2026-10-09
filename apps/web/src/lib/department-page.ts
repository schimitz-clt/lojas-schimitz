/**
 * Department page (/departamento/[slug]) helpers shared by the server page and the client grid.
 * Pure: no fetch, no DOM.
 */
import { CATALOG_PAGE_SIZE, parseCatalogPage } from './catalog-pagination';
import { departmentTitle, parseCatalogSort } from './storefront-pro';

/** Virtual department served by the API (compare-at above price), same slugs as the API. */
export const OFFERS_DEPARTMENT_SLUGS = ['ofertas', 'offers'] as const;

export function isOffersDepartment(slug: string | null | undefined): boolean {
  const s = String(slug || '').trim().toLowerCase();
  return (OFFERS_DEPARTMENT_SLUGS as readonly string[]).includes(s);
}

export const OFFERS_DEPARTMENT_TITLE = 'Ofertas';
export const OFFERS_DEPARTMENT_DESCRIPTION =
  'Ofertas da Lojas Schimitz com preço "de" e "por" de verdade: eletro, celulares e casa em Porto Alegre.';

export type DepartmentListParams = {
  slug: string;
  minPrice?: string | null;
  maxPrice?: string | null;
  sort?: string | null;
  page?: string | null;
};

/** The exact GET /products path the grid requests. Server and client must build the same string. */
export function departmentQueryPath(input: DepartmentListParams): string {
  const params = new URLSearchParams();
  params.set('category', input.slug);
  const minPrice = (input.minPrice || '').trim();
  const maxPrice = (input.maxPrice || '').trim();
  if (minPrice) params.set('minPrice', minPrice);
  if (maxPrice) params.set('maxPrice', maxPrice);
  params.set('sort', parseCatalogSort(input.sort || 'newest'));
  params.set('page', String(parseCatalogPage(input.page)));
  params.set('pageSize', String(CATALOG_PAGE_SIZE));
  return `/products?${params.toString()}`;
}

export type DepartmentCategoryMeta = { name: string; description: string; listed: boolean } | null;

/**
 * Title/description/404 decision for a department.
 * Ofertas is virtual: it never 404s and keeps a proper title even when the categories API is down
 * (before: title fell back to the raw slug "ofertas" and a generic description).
 */
export function departmentSeo(
  slug: string,
  cat: DepartmentCategoryMeta,
  siteTitle: string,
): { title: string; description: string; notFound: boolean } {
  if (isOffersDepartment(slug)) {
    return {
      title: (cat?.listed && cat.name.trim()) || OFFERS_DEPARTMENT_TITLE,
      description: OFFERS_DEPARTMENT_DESCRIPTION,
      notFound: false,
    };
  }
  if (cat && !cat.listed) return { title: '', description: '', notFound: true };
  const title = departmentTitle(slug, cat?.name);
  return {
    title,
    description: cat?.description || `${title} na ${siteTitle} — catálogo em Porto Alegre.`,
    notFound: false,
  };
}

export type DepartmentInitialList<P> = { path: string; items: P[]; total: number };

/** Parse the API list envelope; null when unusable (the client then fetches by itself). */
export function parseDepartmentList<P>(path: string, json: unknown): DepartmentInitialList<P> | null {
  if (!json || typeof json !== 'object') return null;
  const env = json as { ok?: boolean; data?: unknown };
  if (env.ok === false) return null;
  const data = env.data;
  if (Array.isArray(data)) return { path, items: data as P[], total: data.length };
  if (!data || typeof data !== 'object') return null;
  const list = data as { items?: unknown; total?: unknown };
  if (!Array.isArray(list.items)) return null;
  const total = Number(list.total ?? list.items.length);
  return { path, items: list.items as P[], total: Number.isFinite(total) ? total : list.items.length };
}
