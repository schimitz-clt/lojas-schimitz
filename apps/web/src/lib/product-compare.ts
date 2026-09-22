/**
 * Lightweight product compare (max 3). Pure helpers + localStorage shape.
 * Snapshots are catalog fields only — page re-fetches live products by slug.
 */

import { installmentLine, pixPrice, toNumber } from '@/lib/pricing';
import {
  resolveProductImageUrl,
  resolveProductStock,
  stockCompareLabel,
  type ProductInventoryLike,
} from '@/lib/product-media';

export const COMPARE_MAX = 3;
export const COMPARE_STORAGE_KEY = 'sch_compare_v1';
export const COMPARE_EVENT = 'sch-compare-updated';

export type CompareSnapshot = {
  id: string;
  slug: string;
  name: string;
  price: number;
  compareAtPrice: number | null;
  image: string | null;
  categoryName: string | null;
  sellerName: string | null;
  stock: number | null;
  badge: string | null;
  isDemo?: boolean;
};

export type ProductCompareLike = {
  id?: string | null;
  slug?: string | null;
  name?: string | null;
  price?: number | string | null;
  compareAtPrice?: number | string | null;
  images?: { url?: string | null; position?: number }[] | null;
  image?: string | null;
  imageUrl?: string | null;
  stock?: number | null;
  inventory?: ProductInventoryLike | null;
  category?: { name?: string | null; slug?: string | null } | null;
  seller?: { name?: string | null; slug?: string | null } | null;
  badge?: string | null;
  isDemo?: boolean | null;
};

export type CompareRowId =
  | 'price'
  | 'pix'
  | 'installments'
  | 'seller'
  | 'category'
  | 'stock'
  | 'badge';

export type CompareRow = { id: CompareRowId; label: string };

export type ToggleCompareResult = {
  list: CompareSnapshot[];
  inList: boolean;
  reason?: 'full';
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

/** Build a persistable snapshot from a catalog product. */
export function snapshotFromProduct(p: ProductCompareLike): CompareSnapshot | null {
  const id = asText(p.id);
  const slug = asText(p.slug);
  const name = asText(p.name);
  if (!id || !slug || !name) return null;
  const image = resolveProductImageUrl(p);
  return {
    id,
    slug,
    name,
    price: asMoney(p.price),
    compareAtPrice: optionalMoney(p.compareAtPrice),
    image: image || null,
    categoryName: asText(p.category?.name) || null,
    sellerName: asText(p.seller?.name) || null,
    stock: resolveProductStock(p),
    badge: asText(p.badge) || null,
    isDemo: p.isDemo === true,
  };
}

function parseOne(raw: unknown): CompareSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  return snapshotFromProduct({
    id: asText(o.id),
    slug: asText(o.slug),
    name: asText(o.name),
    price: o.price as number | string | null,
    compareAtPrice: o.compareAtPrice as number | string | null,
    image: asText(o.image) || null,
    imageUrl: asText(o.image) || null,
    stock: typeof o.stock === 'number' ? o.stock : o.stock === null ? null : undefined,
    category: { name: asText(o.categoryName) || null },
    seller: { name: asText(o.sellerName) || null },
    badge: asText(o.badge) || null,
    isDemo: o.isDemo === true,
  });
}

/** Sanitize localStorage / untrusted JSON. Max 3, unique by id. */
export function parseCompareList(raw: unknown): CompareSnapshot[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out: CompareSnapshot[] = [];
  const seen = new Set<string>();
  for (const item of arr) {
    const snap = parseOne(item);
    if (!snap || seen.has(snap.id)) continue;
    seen.add(snap.id);
    out.push(snap);
    if (out.length >= COMPARE_MAX) break;
  }
  return out;
}

export function addToCompare(
  list: CompareSnapshot[],
  item: CompareSnapshot,
): ToggleCompareResult {
  const current = parseCompareList(list);
  if (current.some((x) => x.id === item.id)) {
    return { list: current, inList: true };
  }
  if (current.length >= COMPARE_MAX) {
    return { list: current, inList: false, reason: 'full' };
  }
  return { list: [...current, item], inList: true };
}

export function removeFromCompare(list: CompareSnapshot[], id: string): CompareSnapshot[] {
  const key = asText(id);
  return parseCompareList(list).filter((x) => x.id !== key);
}

export function toggleCompareItem(
  list: CompareSnapshot[],
  item: CompareSnapshot,
): ToggleCompareResult {
  const current = parseCompareList(list);
  if (current.some((x) => x.id === item.id)) {
    return { list: current.filter((x) => x.id !== item.id), inList: false };
  }
  return addToCompare(current, item);
}

export function isCompared(list: CompareSnapshot[], id: string): boolean {
  const key = asText(id);
  return Boolean(key) && parseCompareList(list).some((x) => x.id === key);
}

export function mergeCompareSnapshot(
  base: CompareSnapshot,
  product: ProductCompareLike,
): CompareSnapshot {
  const fresh = snapshotFromProduct(product);
  if (!fresh) return base;
  if (fresh.id === base.id || fresh.slug === base.slug) {
    return { ...fresh, id: base.id, slug: fresh.slug || base.slug };
  }
  return base;
}

export function compareRows(): CompareRow[] {
  return [
    { id: 'price', label: 'Preço' },
    { id: 'pix', label: 'No PIX' },
    { id: 'installments', label: 'Parcelas' },
    { id: 'seller', label: 'Vendido por' },
    { id: 'category', label: 'Categoria' },
    { id: 'stock', label: 'Estoque' },
    { id: 'badge', label: 'Selo' },
  ];
}

function brl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function compareCell(item: CompareSnapshot, row: CompareRowId): string {
  switch (row) {
    case 'price':
      return item.price > 0 ? brl(item.price) : '—';
    case 'pix':
      return item.price > 0 ? brl(pixPrice(item.price)) : '—';
    case 'installments':
      return item.price > 0 ? installmentLine(item.price) : '—';
    case 'seller':
      return item.sellerName || '—';
    case 'category':
      return item.categoryName || '—';
    case 'stock':
      return stockCompareLabel(item.stock);
    case 'badge':
      return item.badge || '—';
    default:
      return '—';
  }
}

export function compareToggleLabel(inList: boolean): string {
  return inList ? 'Na comparação' : 'Comparar';
}

export function compareFullMessage(): string {
  return 'Você já comparou 3 produtos. Remova um para adicionar outro.';
}

export function compareEmptyCopy(): { title: string; body: string } {
  return {
    title: 'Nenhum produto para comparar',
    body: 'Adicione até 3 itens pelos cards ou pela página do produto para ver preço, PIX, parcelas, estoque e categoria lado a lado.',
  };
}

export function comparePageHeading(count: number): { title: string; subtitle: string } {
  if (count <= 0) {
    return { title: 'Comparar produtos', subtitle: 'Escolha até 3 itens do catálogo.' };
  }
  const n = Math.min(COMPARE_MAX, count);
  return {
    title: 'Comparar produtos',
    subtitle: n === 1 ? '1 produto selecionado' : `${n} produtos selecionados`,
  };
}

export function compareBarLabel(count: number): string {
  if (count <= 0) return 'Comparar';
  if (count === 1) return '1 produto';
  return `${count} produtos`;
}

/** Sticky bar is hidden on compare/checkout/admin and when empty. */
export function shouldShowCompareBar(path: string, count: number): boolean {
  if (count <= 0) return false;
  const p = (path || '/').trim() || '/';
  if (p === '/comparar' || p.startsWith('/comparar/')) return false;
  if (p === '/checkout' || p.startsWith('/checkout/')) return false;
  if (p === '/admin' || p.startsWith('/admin/')) return false;
  return true;
}

export function readCompareList(): CompareSnapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(COMPARE_STORAGE_KEY);
    if (!raw) return [];
    return parseCompareList(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function writeCompareList(list: CompareSnapshot[]): CompareSnapshot[] {
  const next = parseCompareList(list);
  if (typeof window === 'undefined') return next;
  try {
    window.localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
  try {
    window.dispatchEvent(new Event(COMPARE_EVENT));
  } catch {
    /* ignore */
  }
  return next;
}
