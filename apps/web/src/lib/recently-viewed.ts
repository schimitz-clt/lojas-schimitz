/**
 * Recently viewed products (PDP visits). Pure helpers + localStorage shape.
 * Snapshots are catalog fields only — never invent stock.
 */

import { toNumber } from '@/lib/pricing';
import { resolveProductImageUrl } from '@/lib/product-media';

export const RECENT_MAX = 12;
export const RECENT_STORAGE_KEY = 'sch_recent_v1';
export const RECENT_EVENT = 'sch-recent-updated';

export type RecentSnapshot = {
  id: string;
  slug: string;
  name: string;
  price: number;
  compareAtPrice: number | null;
  image: string | null;
  categoryName: string | null;
  viewedAt: number;
};

export type RecentProductLike = {
  id?: string | null;
  slug?: string | null;
  name?: string | null;
  price?: number | string | null;
  compareAtPrice?: number | string | null;
  images?: { url?: string | null; position?: number }[] | null;
  image?: string | null;
  imageUrl?: string | null;
  category?: { name?: string | null; slug?: string | null } | null;
};

function asText(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function asMoney(v: unknown): number {
  return toNumber(v as number | string | null | undefined);
}

function optionalMoney(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = asMoney(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Persistable snapshot from a live catalog/PDP product. */
export function snapshotRecentProduct(
  p: RecentProductLike,
  viewedAt = 0,
): RecentSnapshot | null {
  const id = asText(p.id);
  const slug = asText(p.slug);
  const name = asText(p.name);
  if (!id || !slug || !name) return null;
  const image = resolveProductImageUrl(p);
  const at = Number.isFinite(viewedAt) && viewedAt > 0 ? viewedAt : 0;
  return {
    id,
    slug,
    name,
    price: asMoney(p.price),
    compareAtPrice: optionalMoney(p.compareAtPrice),
    image: image || null,
    categoryName: asText(p.category?.name) || null,
    viewedAt: at,
  };
}

function parseOne(raw: unknown): RecentSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const viewedAt = typeof o.viewedAt === 'number' && Number.isFinite(o.viewedAt) ? o.viewedAt : 0;
  return snapshotRecentProduct(
    {
      id: asText(o.id),
      slug: asText(o.slug),
      name: asText(o.name),
      price: o.price as number | string | null,
      compareAtPrice: o.compareAtPrice as number | string | null,
      image: asText(o.image) || null,
      imageUrl: asText(o.image) || null,
      category: { name: asText(o.categoryName) || null },
    },
    viewedAt,
  );
}

/** Sanitize localStorage / untrusted JSON. Unique by id, newest first, max RECENT_MAX. */
export function parseRecentList(raw: unknown): RecentSnapshot[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out: RecentSnapshot[] = [];
  const seen = new Set<string>();
  const parsed: RecentSnapshot[] = [];
  for (const item of arr) {
    const snap = parseOne(item);
    if (snap) parsed.push(snap);
  }
  parsed.sort((a, b) => (b.viewedAt || 0) - (a.viewedAt || 0));
  for (const snap of parsed) {
    if (seen.has(snap.id)) continue;
    seen.add(snap.id);
    out.push(snap);
    if (out.length >= RECENT_MAX) break;
  }
  return out;
}

/** Move/insert item to the front. Drops older duplicates. */
export function rememberViewed(
  list: RecentSnapshot[],
  item: RecentSnapshot,
  now = Date.now(),
): RecentSnapshot[] {
  const snap = snapshotRecentProduct(item, item.viewedAt || now);
  if (!snap) return parseRecentList(list);
  const next: RecentSnapshot = { ...snap, viewedAt: now };
  const rest = parseRecentList(list).filter((x) => x.id !== next.id && x.slug !== next.slug);
  return parseRecentList([next, ...rest]);
}

export function removeFromRecent(list: RecentSnapshot[], id: string): RecentSnapshot[] {
  const key = asText(id);
  return parseRecentList(list).filter((x) => x.id !== key);
}

/** Hide the current PDP product from the strip. */
export function recentListExcluding(
  list: RecentSnapshot[],
  currentId?: string | null,
  currentSlug?: string | null,
): RecentSnapshot[] {
  const id = asText(currentId);
  const slug = asText(currentSlug);
  return parseRecentList(list).filter((x) => {
    if (id && x.id === id) return false;
    if (slug && x.slug === slug) return false;
    return true;
  });
}

export function recentStripHeading(count: number): { title: string; subtitle: string } {
  if (count <= 0) {
    return { title: 'Vistos recentemente', subtitle: 'Os produtos que você abrir aparecem aqui.' };
  }
  return {
    title: 'Vistos recentemente',
    subtitle: count === 1 ? '1 produto' : `${count} produtos`,
  };
}

export function recentClearLabel(): string {
  return 'Limpar histórico';
}

/** Strip is hidden on checkout/admin/auth and when empty. */
export function shouldShowRecentStrip(path: string, count: number): boolean {
  if (count <= 0) return false;
  const p = (path || '/').trim() || '/';
  if (p === '/checkout' || p.startsWith('/checkout/')) return false;
  if (p === '/carrinho' || p.startsWith('/carrinho/')) return false;
  if (p === '/admin' || p.startsWith('/admin/')) return false;
  if (p === '/entrar' || p.startsWith('/entrar')) return false;
  if (p === '/cadastro' || p.startsWith('/cadastro')) return false;
  return true;
}

export function readRecentList(): RecentSnapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    return parseRecentList(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function writeRecentList(list: RecentSnapshot[]): RecentSnapshot[] {
  const next = parseRecentList(list);
  if (typeof window === 'undefined') return next;
  try {
    window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
  try {
    window.dispatchEvent(new Event(RECENT_EVENT));
  } catch {
    /* ignore */
  }
  return next;
}

export function rememberProductView(product: RecentProductLike): RecentSnapshot[] {
  const snap = snapshotRecentProduct(product, Date.now());
  if (!snap) return readRecentList();
  return writeRecentList(rememberViewed(readRecentList(), snap, snap.viewedAt));
}

export function clearRecentList(): RecentSnapshot[] {
  return writeRecentList([]);
}
