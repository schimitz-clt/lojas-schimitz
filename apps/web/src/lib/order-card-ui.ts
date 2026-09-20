/**
 * Meus pedidos card copy + thumbs from customer /orders line items.
 * Display only — does not change payment or status.
 */

import { isMissingOrPlaceholderImage } from '@/lib/placeholder-image';
import { rewritePublicUploadUrl } from '@/lib/public-upload-url';

export type OrderCardItemLike = {
  name?: string | null;
  productName?: string | null;
  description?: string | null;
  productDescription?: string | null;
  qty?: number | null;
  imageUrl?: string | null;
  image?: string | null;
  product?: {
    description?: string | null;
    images?: { url?: string | null; position?: number }[] | null;
  } | null;
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

/** Honest leftover count for Conta “pedido em andamento”. */
export function extraItemsHonestLabel(extra: number): string | null {
  if (extra <= 0) return null;
  return extra === 1 ? '+1 item' : `+${extra} itens`;
}

/** First line-item name only — extras go on `extraItemsHonestLabel`. */
export function orderCardPrimaryName(order: OrderCardOrderLike): string {
  return orderItemDisplayName(order.items?.[0]) || asName(order.publicId);
}

/** Catalog / snapshot description; empty when the API has none. */
export function orderItemDescription(item: OrderCardItemLike | null | undefined): string {
  if (!item) return '';
  return (
    asName(item.description) ||
    asName(item.productDescription) ||
    asName(item.product?.description)
  );
}

/** Mobile-readable key line; does not invent copy when description is empty. */
export const ORDER_CARD_DESC_MAX = 96;

export function shortOrderCardDescription(
  raw?: string | null,
  max = ORDER_CARD_DESC_MAX,
): string {
  const text = asName(raw).replace(/\s+/g, ' ');
  if (!text) return '';
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const breakAt = Math.max(slice.lastIndexOf(' '), slice.lastIndexOf(','), slice.lastIndexOf('.'));
  const cut = breakAt >= 36 ? slice.slice(0, breakAt) : slice;
  return `${cut.replace(/[\s.,;:]+$/, '')}…`;
}

export function orderCardDescription(items: OrderCardItemLike[] | null | undefined): string {
  const list = Array.isArray(items) ? items : [];
  return shortOrderCardDescription(orderItemDescription(list[0]));
}

/** Description under the title; hidden when empty or identical to the name. */
export function orderCardSecondaryLine(order: OrderCardOrderLike): string {
  const title = orderItemDisplayName(order.items?.[0]);
  const desc = orderCardDescription(order.items);
  if (!desc) return '';
  if (title && desc.toLowerCase() === title.toLowerCase()) return '';
  return desc;
}

export type InProgressOrderCardSummary = {
  title: string;
  description: string;
  imageUrl: string;
  extraLabel: string | null;
  publicId: string;
};

/** Cover of the first line item only (placeholder if that row has no real photo). */
export function orderCardPrimaryImageUrl(items: OrderCardItemLike[] | null | undefined): string {
  const list = Array.isArray(items) ? items : [];
  return orderItemImageUrl(list[0]);
}

/** Conta “Pedido em andamento”: first product + photo + short desc. */
export function inProgressOrderCardSummary(order: OrderCardOrderLike): InProgressOrderCardSummary {
  return {
    title: orderCardPrimaryName(order),
    description: orderCardSecondaryLine(order),
    imageUrl: orderCardPrimaryImageUrl(order.items),
    extraLabel: extraItemsHonestLabel(extraItemsCount(order.items)),
    publicId: asName(order.publicId),
  };
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
