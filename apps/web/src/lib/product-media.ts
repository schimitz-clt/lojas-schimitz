/**
 * Shared product image + stock resolvers for cards, gallery, and compare.
 * Display only — does not mutate inventory.
 */

import { isMissingOrPlaceholderImage } from '@/lib/placeholder-image';
import { rewritePublicUploadUrl } from '@/lib/public-upload-url';

/**
 * Public catalog serializes `{ available }` only (F12).
 * Admin/seller payloads may still include qtyOnHand / qtyReserved.
 */
export type ProductInventoryLike = {
  qtyOnHand?: number;
  qtyReserved?: number;
  available?: number | null;
};

export type ProductMediaLike = {
  images?: { url?: string | null; position?: number }[] | null;
  image?: string | null;
  imageUrl?: string | null;
  stock?: number | null;
  inventory?: ProductInventoryLike | null;
};

/** First usable catalog photo (nested images, then flat image/imageUrl). */
export function resolveProductImageUrl(p: ProductMediaLike): string {
  const nested = [...(p.images || [])]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((i) => (i.url || '').trim())
    .find(Boolean);
  const flat = (p.image || p.imageUrl || '').trim();
  const raw = nested || flat;
  const rewritten = rewritePublicUploadUrl(raw) || raw;
  if (isMissingOrPlaceholderImage(rewritten)) return '';
  return rewritten;
}

/** Available units from flat `stock` or inventory; null = sob consulta. */
export function resolveProductStock(p: ProductMediaLike): number | null {
  if (typeof p.stock === 'number') return p.stock;
  if (p.stock === null) return null;
  if (typeof p.inventory?.available === 'number') return Math.max(0, p.inventory.available);
  if (p.inventory && typeof p.inventory.qtyOnHand === 'number') {
    return Math.max(0, p.inventory.qtyOnHand - (p.inventory.qtyReserved ?? 0));
  }
  return null;
}

/** Portuguese stock line for compare / PDP — always a string. */
export function stockCompareLabel(stock: number | null | undefined): string {
  if (stock == null) return 'Sob consulta';
  if (stock <= 0) return 'Esgotado';
  if (stock <= 5) return `Últimas unidades (${stock})`;
  return `Em estoque (${stock})`;
}
