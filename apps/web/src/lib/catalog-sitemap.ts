/** Public list page size cap (GET /products). Sitemap only emits slugs the API returned. */
export const SITEMAP_PAGE_SIZE = 60;
export const SITEMAP_MAX_PAGES = 100;

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
