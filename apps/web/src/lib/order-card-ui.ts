/**
 * Meus pedidos card copy + thumbs from customer /orders line items.
 * Display only — does not change payment or status.
 */

import { isMissingOrPlaceholderImage } from '@/lib/placeholder-image';
import { rewritePublicUploadUrl } from '@/lib/public-upload-url';

export type OrderCardItemLike = {
  name?: string | null;
  productName?: string | null;
  qty?: number | null;
  imageUrl?: string | null;
  image?: string | null;
  product?: { images?: { url?: string | null; position?: number }[] | null } | null;
};

export type OrderCardOrderLike = {
  publicId?: string | null;
  items?: OrderCardItemLike[] | null;
};

function asName(value?: string | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Snapshot name, then productName alias. */
export function orderItemDisplayName(item: OrderCardItemLike | null | undefined): string {
  if (!item) return '';
  return asName(item.productName) || asName(item.name);
}

export function orderItemImageUrl(item: OrderCardItemLike | null | undefined): string {
  if (!item) return '';
  const nested = [...(item.product?.images || [])]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((i) => (i.url || '').trim())
    .find(Boolean);
  const raw = (item.imageUrl || item.image || nested || '').trim();
  const rewritten = rewritePublicUploadUrl(raw) || raw;
  if (isMissingOrPlaceholderImage(rewritten)) return '';
  return rewritten;
}

/** First line-item name as hero; extras as “e mais N”. Empty items → ''. */
export function orderCardTitle(items: OrderCardItemLike[] | null | undefined): string {
  const list = Array.isArray(items) ? items : [];
  const primary = orderItemDisplayName(list[0]);
  if (!primary) return '';
  const extra = Math.max(0, list.length - 1);
  if (extra === 1) return `${primary} e mais 1`;
  if (extra > 1) return `${primary} e mais ${extra}`;
  return primary;
}

export function orderCardTitleOrCode(order: OrderCardOrderLike): string {
  return orderCardTitle(order.items) || asName(order.publicId);
}

export function extraItemsCount(items: OrderCardItemLike[] | null | undefined): number {
  const n = Array.isArray(items) ? items.length : 0;
  return Math.max(0, n - 1);
}

export function extraItemsLabel(extra: number): string | null {
  if (extra <= 0) return null;
  return extra === 1 ? '+1' : `+${extra}`;
}

/** First usable photo among line items (prefers first item). */
export function orderCardImageUrl(items: OrderCardItemLike[] | null | undefined): string {
  const list = Array.isArray(items) ? items : [];
  for (const item of list) {
    const url = orderItemImageUrl(item);
    if (url) return url;
  }
  return '';
}

export function orderCardImageUrls(
  items: OrderCardItemLike[] | null | undefined,
  max = 3,
): string[] {
  const list = Array.isArray(items) ? items : [];
  const urls: string[] = [];
  for (const item of list) {
    const url = orderItemImageUrl(item);
    if (url && !urls.includes(url)) urls.push(url);
    if (urls.length >= max) break;
  }
  return urls;
}
