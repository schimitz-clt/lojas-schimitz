/** Storefront list page size. Matches the public API default; the API caps pageSize at 60. */
export const CATALOG_PAGE_SIZE = 24;

export function parseCatalogPage(raw: string | null | undefined): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

export function catalogPageCount(total: number, pageSize = CATALOG_PAGE_SIZE): number {
  if (!Number.isFinite(total) || total <= 0) return 1;
  const size = pageSize > 0 ? pageSize : CATALOG_PAGE_SIZE;
  return Math.max(1, Math.ceil(total / size));
}

export function catalogPageRange(
  page: number,
  total: number,
  pageSize = CATALOG_PAGE_SIZE,
): { start: number; end: number; pages: number } {
  const pages = catalogPageCount(total, pageSize);
  const safePage = Math.min(Math.max(1, page), pages);
  if (total <= 0) return { start: 0, end: 0, pages };
  const start = (safePage - 1) * pageSize + 1;
  const end = Math.min(total, safePage * pageSize);
  return { start, end, pages };
}

/** Drop page=1 so filtered URLs stay short. */
export function catalogPageSearch(current: URLSearchParams, page: number): string {
  const next = new URLSearchParams(current);
  if (page <= 1) next.delete('page');
  else next.set('page', String(page));
  return next.toString();
}
