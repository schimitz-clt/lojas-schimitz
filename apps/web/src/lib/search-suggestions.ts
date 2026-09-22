/**
 * Header search suggestions — rank/filter real catalog + category results.
 * No mock products. Network stays in the UI; this file is pure.
 */

import { parseHomeShelvesPayload } from '@/lib/home-shelves';
import { stockBadge, toNumber } from '@/lib/pricing';
import { resolveProductImageUrl, resolveProductStock } from '@/lib/product-media';
import { pixHighlight } from '@/lib/storefront-pro';
import { isDemoCatalogProduct } from '@/lib/demo-catalog';

export const SEARCH_SUGGEST_MIN = 2;
export const SEARCH_SUGGEST_DEBOUNCE_MS = 280;
export const SEARCH_SUGGEST_PRODUCT_LIMIT = 6;
export const SEARCH_SUGGEST_CATEGORY_LIMIT = 3;
export const SEARCH_FOCUS_PRODUCT_LIMIT = 4;
export const SEARCH_FOCUS_SHORTCUT_LIMIT = 6;

export type SearchProductLike = {
  id?: string | null;
  name?: string | null;
  slug?: string | null;
  price?: number | string | null;
  category?: { name?: string | null; slug?: string | null } | null;
  image?: string | null;
  imageUrl?: string | null;
  images?: { url?: string | null; position?: number }[] | null;
  stock?: number | null;
  isDemo?: boolean | null;
  inventory?: { qtyOnHand?: number; qtyReserved?: number; available?: number | null } | null;
};

export type SearchCategoryLike = {
  id?: string | null;
  name?: string | null;
  slug?: string | null;
};

export type SuggestionKind = 'category' | 'product' | 'all';

export type SuggestionRow = {
  id: string;
  kind: SuggestionKind;
  href: string;
  label: string;
  sub?: string;
  /** Catalog photo when the API sent a real image — never a placeholder host. */
  image?: string;
  priceLabel?: string;
  pixLabel?: string;
  pixTag?: string;
  /** Present when the row is a real catalog product (same id the cart POST uses). */
  productId?: string;
  /** False when the SKU is esgotado — hide the sacola button, keep the PDP tap. */
  canAdd?: boolean;
};

function asText(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export function normalizeSearchQuery(q: string | null | undefined): string {
  return (q || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function shouldFetchSuggestions(q: string | null | undefined): boolean {
  return normalizeSearchQuery(q).length >= SEARCH_SUGGEST_MIN;
}

/**
 * Suggestions may prefetch while typing, but the overlay must stay closed on
 * /produtos?q= until the shopper focuses the field again (Magalu results UX).
 */
export function shouldOpenSuggestionPanel(input: {
  focused: boolean;
  open?: boolean;
}): boolean {
  return Boolean(input.focused);
}

export function catalogSearchHref(q: string | null | undefined): string {
  const t = (q || '').trim();
  return t ? `/produtos?q=${encodeURIComponent(t)}` : '/produtos';
}

export function productSuggestHref(slug: string): string {
  const s = asText(slug);
  return s ? `/produto/${encodeURIComponent(s)}` : '/produtos';
}

export function categorySuggestHref(slug: string): string {
  const s = asText(slug);
  return s ? `/departamento/${encodeURIComponent(s)}` : '/produtos';
}

/** Unwrap GET /products — array legacy or { items }. */
export function productsFromListResponse(data: unknown): SearchProductLike[] {
  if (Array.isArray(data)) {
    return data.filter((x) => x && typeof x === 'object') as SearchProductLike[];
  }
  if (data && typeof data === 'object') {
    const items = (data as { items?: unknown }).items;
    if (Array.isArray(items)) {
      return items.filter((x) => x && typeof x === 'object') as SearchProductLike[];
    }
  }
  return [];
}

export function categoriesFromListResponse(data: unknown): SearchCategoryLike[] {
  if (!Array.isArray(data)) return [];
  return data.filter((x) => x && typeof x === 'object') as SearchCategoryLike[];
}

export function formatSuggestionMoney(price: number | string | null | undefined): string | undefined {
  const n = toNumber(price);
  if (!(n > 0)) return undefined;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** List price + PIX 5% hint from the same storefront helpers as cards/PDP. */
export function suggestionPixFields(price: number | string | null | undefined): {
  priceLabel?: string;
  pixLabel?: string;
  pixTag?: string;
} {
  const priceLabel = formatSuggestionMoney(price);
  if (!priceLabel) return {};
  const pix = pixHighlight(price ?? 0);
  const pixLabel = formatSuggestionMoney(pix.pix);
  return {
    priceLabel,
    pixLabel: pixLabel ? `${pixLabel} no PIX` : undefined,
    pixTag: pix.tag,
  };
}

export function productSuggestionImage(p: SearchProductLike): string | undefined {
  const url = resolveProductImageUrl(p);
  return url || undefined;
}

/** Quick add uses the same cart rules as cards: known id, not esgotado. */
export function suggestionCanQuickAdd(p: SearchProductLike): boolean {
  if (!asText(p.id)) return false;
  if (isDemoCatalogProduct(p)) return false;
  return stockBadge(resolveProductStock(p))?.tone !== 'out';
}

export function searchFocusHeading(): string {
  return 'Em alta';
}

function toProductSuggestionRow(p: SearchProductLike, id: string): SuggestionRow | null {
  const pid = asText(p.id);
  const slug = asText(p.slug);
  const name = asText(p.name);
  if (!id || !slug || !name) return null;
  return {
    id,
    kind: 'product',
    href: productSuggestHref(slug),
    label: name,
    sub: asText(p.category?.name) || undefined,
    image: productSuggestionImage(p),
    productId: pid || undefined,
    canAdd: suggestionCanQuickAdd(p),
    ...suggestionPixFields(p.price),
  };
}

/**
 * Real shelf products for the empty search panel.
 * Featured (mais vendidos / destaque) first, then ofertas, then novidades.
 * No invented SKUs — empty when the shelves payload has none.
 */
export function highlightProductsFromShelves(
  data: unknown,
  limit = SEARCH_FOCUS_PRODUCT_LIMIT,
): SearchProductLike[] {
  const shelves = parseHomeShelvesPayload<SearchProductLike>(data);
  if (!shelves?.length) return [];
  const cap = Math.max(1, limit);
  const out: SearchProductLike[] = [];
  const seen = new Set<string>();
  for (const id of ['featured', 'offers', 'newest'] as const) {
    const shelf = shelves.find((s) => s.id === id);
    for (const p of shelf?.items || []) {
      const key = asText(p.id) || asText(p.slug);
      if (!key || !asText(p.name) || !asText(p.slug) || seen.has(key)) continue;
      seen.add(key);
      out.push(p);
      if (out.length >= cap) return out;
    }
  }
  return out;
}

/** Real departments already returned by GET /categories. */
export function focusCategoryShortcuts(
  categories: SearchCategoryLike[],
  limit = SEARCH_FOCUS_SHORTCUT_LIMIT,
): SuggestionRow[] {
  const cap = Math.max(1, limit);
  const out: SuggestionRow[] = [];
  const seen = new Set<string>();
  for (const c of categoriesFromListResponse(categories)) {
    const name = asText(c.name);
    const slug = asText(c.slug);
    if (!name || !slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push({
      id: `focus-cat-${slug}`,
      kind: 'category',
      href: categorySuggestHref(slug),
      label: name,
      sub: 'Departamento',
    });
    if (out.length >= cap) break;
  }
  return out;
}

export type FocusFallbackShortcut = { id: string; href: string; label: string };

/** Curated department/catalog links when the live category list is empty. Skips WhatsApp. */
export function focusFallbackShortcuts(
  items: { href?: string | null; label?: string | null; external?: boolean }[],
  limit = SEARCH_FOCUS_SHORTCUT_LIMIT,
): FocusFallbackShortcut[] {
  const cap = Math.max(1, limit);
  const out: FocusFallbackShortcut[] = [];
  const seen = new Set<string>();
  for (const s of items) {
    if (s.external || /^https?:\/\//i.test(asText(s.href))) continue;
    const href = asText(s.href);
    const label = asText(s.label);
    if (!href.startsWith('/') || !label || seen.has(href)) continue;
    seen.add(href);
    out.push({ id: `focus-sc-${out.length}`, href, label });
    if (out.length >= cap) break;
  }
  return out;
}

export function focusHighlightRows(
  products: SearchProductLike[],
  limit = SEARCH_FOCUS_PRODUCT_LIMIT,
): SuggestionRow[] {
  const cap = Math.max(1, limit);
  const rows: SuggestionRow[] = [];
  const seen = new Set<string>();
  for (const p of products) {
    const key = asText(p.id) || asText(p.slug);
    if (!key || seen.has(key)) continue;
    const row = toProductSuggestionRow(p, `hi-${key}`);
    if (!row) continue;
    seen.add(key);
    rows.push(row);
    if (rows.length >= cap) break;
  }
  return rows;
}

function scoreProduct(p: SearchProductLike, nq: string): number {
  const name = normalizeSearchQuery(asText(p.name));
  const slug = normalizeSearchQuery(asText(p.slug));
  const cat = normalizeSearchQuery(asText(p.category?.name) || asText(p.category?.slug));
  if (!nq) return 0;
  if (name === nq || slug === nq) return 6;
  if (name.startsWith(nq) || slug.startsWith(nq)) return 4;
  if (name.includes(nq) || slug.includes(nq)) return 3;
  if (cat.startsWith(nq)) return 2;
  if (cat.includes(nq)) return 1;
  return 0.5;
}

/** Rank API hits: name/slug first, then category, then other API matches. */
export function rankProductSuggestions(
  items: SearchProductLike[],
  q: string,
  limit = SEARCH_SUGGEST_PRODUCT_LIMIT,
): SearchProductLike[] {
  const nq = normalizeSearchQuery(q);
  const seen = new Set<string>();
  const scored = productsFromListResponse(items)
    .filter((p) => asText(p.id) && asText(p.slug) && asText(p.name))
    .map((p) => ({ p, score: scoreProduct(p, nq) }))
    .sort((a, b) => b.score - a.score || asText(a.p.name).localeCompare(asText(b.p.name), 'pt-BR'));
  const out: SearchProductLike[] = [];
  for (const { p } of scored) {
    const key = asText(p.id) || asText(p.slug);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(p);
    if (out.length >= Math.max(1, limit)) break;
  }
  return out;
}

export function filterCategorySuggestions(
  categories: SearchCategoryLike[],
  q: string,
  limit = SEARCH_SUGGEST_CATEGORY_LIMIT,
): SearchCategoryLike[] {
  const nq = normalizeSearchQuery(q);
  if (!nq) return [];
  const out: SearchCategoryLike[] = [];
  const seen = new Set<string>();
  for (const c of categoriesFromListResponse(categories)) {
    const name = asText(c.name);
    const slug = asText(c.slug);
    if (!name || !slug) continue;
    const hay = `${normalizeSearchQuery(name)} ${normalizeSearchQuery(slug)}`;
    if (!hay.includes(nq)) continue;
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push({ id: asText(c.id) || slug, name, slug });
    if (out.length >= Math.max(1, limit)) break;
  }
  return out;
}

export function buildSuggestionRows(input: {
  q: string;
  products?: SearchProductLike[];
  categories?: SearchCategoryLike[];
}): SuggestionRow[] {
  const q = (input.q || '').trim();
  const rows: SuggestionRow[] = [];
  const cats = filterCategorySuggestions(input.categories || [], q);
  for (const c of cats) {
    const slug = asText(c.slug);
    rows.push({
      id: `cat-${slug}`,
      kind: 'category',
      href: categorySuggestHref(slug),
      label: asText(c.name) || slug,
      sub: 'Departamento',
    });
  }
  const products = rankProductSuggestions(input.products || [], q);
  for (const p of products) {
    const id = asText(p.id) || asText(p.slug);
    const row = toProductSuggestionRow(p, `p-${id}`);
    if (row) rows.push(row);
  }
  if (q) {
    rows.push({
      id: 'all',
      kind: 'all',
      href: catalogSearchHref(q),
      label: `Ver todos os resultados para “${q}”`,
    });
  }
  return rows;
}

/** True when the API/category filter produced a real hit (not only “ver todos”). */
export function hasCatalogSuggestionHits(rows: SuggestionRow[]): boolean {
  return rows.some((r) => r.kind === 'product' || r.kind === 'category');
}

/** -1 = input itself; wrap at ends. */
export function nextSuggestionIndex(current: number, total: number, delta: number): number {
  if (!Number.isFinite(total) || total <= 0) return -1;
  const cur = Number.isFinite(current) ? current : -1;
  const step = delta < 0 ? -1 : 1;
  let next = cur + step;
  if (next < -1) return total - 1;
  if (next >= total) return -1;
  return next;
}

export function suggestionsStatusLabel(opts: {
  q: string;
  loading: boolean;
  count: number;
}): string {
  const q = opts.q.trim();
  if (!shouldFetchSuggestions(q)) return '';
  if (opts.loading) return `Buscando “${q}”…`;
  if (opts.count <= 0) return `Nenhuma sugestão para “${q}”.`;
  return opts.count === 1 ? '1 sugestão' : `${opts.count} sugestões`;
}

export function searchBoxAriaControlsId(): string {
  return 'hdr-search-suggest';
}
