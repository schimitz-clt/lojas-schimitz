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
