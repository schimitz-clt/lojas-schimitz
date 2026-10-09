/** Public list page size cap (GET /products). Sitemap only emits slugs the API returned. */
export const SITEMAP_PAGE_SIZE = 60;
export const SITEMAP_MAX_PAGES = 100;

export type SitemapChangeFrequency = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';

export type SitemapStaticPage = {
  path: string;
  changeFrequency: SitemapChangeFrequency;
  priority: number;
};

/**
 * Indexable storefront URLs. Account, cart, checkout, and auth screens stay out:
 * they are noindex and must not be listed next to the catalog.
 */
export const SITEMAP_STATIC_PAGES: SitemapStaticPage[] = [
  { path: '/', changeFrequency: 'daily', priority: 1 },
  { path: '/produtos', changeFrequency: 'daily', priority: 0.9 },
  { path: '/marketplace', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/suporte', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/privacidade', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/termos', changeFrequency: 'yearly', priority: 0.4 },
];

export function sitemapStaticEntries(origin: string): {
  url: string;
  changeFrequency: SitemapChangeFrequency;
  priority: number;
}[] {
  const base = origin.replace(/\/$/, '');
  return SITEMAP_STATIC_PAGES.map((page) => ({
    url: page.path === '/' ? `${base}/` : `${base}${page.path}`,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}

export function sitemapShouldFetchNext(input: {
  page: number;
  pageSize: number;
  received: number;
  total: number;
  maxPages?: number;
}): boolean {
  const maxPages = input.maxPages ?? SITEMAP_MAX_PAGES;
  if (input.received <= 0) return false;
  if (input.page >= maxPages) return false;
  if (input.received < input.pageSize) return false;
  if (!Number.isFinite(input.total) || input.total < 0) return false;
  if (input.page * input.pageSize >= input.total) return false;
  return true;
}

export function sitemapProductPath(slug: string): string | null {
  const s = slug.trim();
  if (!s || s.length > 120 || /[\s/?#]/.test(s)) return null;
  return `/produto/${encodeURIComponent(s)}`;
}

export function sitemapCategoryPath(slug: string): string | null {
  const s = slug.trim();
  if (!s || s.length > 120 || /[\s/?#]/.test(s)) return null;
  return `/departamento/${encodeURIComponent(s)}`;
}

/** Skip demo rows and inactive rows. Missing flags still pass when the slug is public. */
export function sitemapAcceptsProduct(input: {
  slug?: string | null;
  isDemo?: boolean | null;
  active?: boolean | null;
}): boolean {
  if (input.isDemo === true) return false;
  if (input.active === false) return false;
  return sitemapProductPath(input.slug || '') !== null;
}

/** Invalid timestamps are omitted so the sitemap route does not throw while serializing. */
export function sitemapLastModified(value: unknown): Date | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

export type SitemapEntry = {
  url: string;
  changeFrequency: SitemapChangeFrequency;
  priority: number;
  lastModified?: Date;
};

/** Fetch JSON from the API. Must throw on network errors and on non-2xx responses. */
export type SitemapFetchJson = (url: string) => Promise<unknown>;

export type CatalogSitemapResult = {
  products: SitemapEntry[];
  categories: SitemapEntry[];
  /** False when any API call failed. The caller must not cache or hide this. */
  complete: boolean;
  errors: string[];
};

type ProductsPage = { ok?: boolean; data?: { items?: SitemapProductRow[]; total?: number } };
type SitemapProductRow = { slug?: string; updatedAt?: string; isDemo?: boolean; active?: boolean };
type CategoriesPayload = { ok?: boolean; data?: { slug?: string }[] };

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Product and category entries for /sitemap.xml.
 *
 * Products and categories are collected independently: one failing does not drop the other.
 * `complete=false` tells the route the result is partial. Before 09/10/2026 the route swallowed
 * the error and Next cached the static-only sitemap (6 URLs) for up to an hour after each deploy.
 */
export async function collectCatalogSitemap(opts: {
  origin: string;
  apiBase: string;
  fetchJson: SitemapFetchJson;
  pageSize?: number;
  maxPages?: number;
}): Promise<CatalogSitemapResult> {
  const base = opts.origin.replace(/\/$/, '');
  const api = opts.apiBase.replace(/\/$/, '');
  const pageSize = opts.pageSize ?? SITEMAP_PAGE_SIZE;
  const maxPages = opts.maxPages ?? SITEMAP_MAX_PAGES;
  const errors: string[] = [];

  const products: SitemapEntry[] = [];
  const seenProducts = new Set<string>();
  try {
    let page = 1;
    let fetched = 0;
    while (page <= maxPages) {
      const json = (await opts.fetchJson(`${api}/products?page=${page}&pageSize=${pageSize}`)) as ProductsPage;
      if (!json || json.ok === false || !json.data) throw new Error(`products page ${page}: envelope sem data`);
      const batch = json.data.items || [];
      fetched += batch.length;
      for (const p of batch) {
        if (!sitemapAcceptsProduct(p)) continue;
        const path = sitemapProductPath(p.slug || '');
        if (!path || seenProducts.has(path)) continue;
        seenProducts.add(path);
        const lastModified = sitemapLastModified(p.updatedAt);
        products.push({
          url: `${base}${path}`,
          changeFrequency: 'weekly',
          priority: 0.8,
          ...(lastModified ? { lastModified } : {}),
        });
      }
      const total = Number(json.data.total ?? fetched);
      if (!sitemapShouldFetchNext({ page, pageSize, received: batch.length, total, maxPages })) break;
      page += 1;
    }
  } catch (err) {
    errors.push(`products: ${errorText(err)}`);
  }

  const categories: SitemapEntry[] = [];
  try {
    const json = (await opts.fetchJson(`${api}/categories`)) as CategoriesPayload;
    if (!json || json.ok === false || !Array.isArray(json.data)) throw new Error('envelope sem data');
    const seen = new Set<string>();
    for (const c of json.data) {
      const path = sitemapCategoryPath(c.slug || '');
      if (!path || seen.has(path)) continue;
      seen.add(path);
      categories.push({ url: `${base}${path}`, changeFrequency: 'weekly', priority: 0.6 });
    }
  } catch (err) {
    errors.push(`categories: ${errorText(err)}`);
  }

  return { products, categories, complete: errors.length === 0, errors };
}
