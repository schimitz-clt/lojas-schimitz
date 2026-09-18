/**
 * Customer order line items: snapshot name + cover photo, with live ProductImage fallback.
 * Additive — does not change totals, payments, or fulfillment.
 */

import { rewritePublicUploadUrl } from '../../common/public-upload-url';
import { primaryImageUrl, type ImageLike } from '../catalog/product.serialize';

export type OrderItemProductSnap = {
  sku?: string | null;
  images?: ImageLike[] | null;
};

export type OrderItemSerializeSource = {
  id: string;
  productId?: string;
  name: string;
  qty: number;
  unitPrice: unknown;
  sellerId?: string | null;
  imageUrl?: string | null;
  product?: OrderItemProductSnap | null;
};

/** Prisma select used by customer list/detail so historical rows can fall back by productId. */
export const ORDER_ITEM_CUSTOMER_SELECT = {
  id: true,
  productId: true,
  name: true,
  qty: true,
  unitPrice: true,
  sellerId: true,
  imageUrl: true,
  product: {
    select: {
      sku: true,
      images: {
        orderBy: { position: 'asc' as const },
        take: 1,
        select: { url: true, position: true },
      },
    },
  },
} as const;

function isUnusablePhoto(url?: string | null): boolean {
  const t = typeof url === 'string' ? url.trim() : '';
  if (!t) return true;
  const lower = t.toLowerCase();
  if (lower === 'null' || lower === 'undefined' || lower === '#' || lower === 'about:blank') {
    return true;
  }
  return /placehold\.co|placehold\.it|via\.placeholder\.com|placeholder\.com/i.test(t);
}

/** Rewritten public URL, or null when empty/placeholder. */
export function usableOrderItemImageUrl(url?: string | null): string | null {
  const raw = typeof url === 'string' ? url.trim() : '';
  if (!raw) return null;
  const rewritten = rewritePublicUploadUrl(raw) || raw;
  if (isUnusablePhoto(rewritten)) return null;
  return rewritten;
}

/**
 * Cover photo for a line item:
 * 1. OrderItem.imageUrl snapshot (new orders)
 * 2. Current ProductImage cover by productId
 * 3. null → UI placeholder
 */
export function resolveOrderItemImageUrl(item: {
  imageUrl?: string | null;
  product?: OrderItemProductSnap | null;
}): string | null {
  const fromSnap = usableOrderItemImageUrl(item.imageUrl);
  if (fromSnap) return fromSnap;
  return usableOrderItemImageUrl(primaryImageUrl(item.product?.images));
}

export function serializeCustomerOrderItem(item: OrderItemSerializeSource) {
  const imageUrl = resolveOrderItemImageUrl(item);
  return {
    id: item.id,
    productId: item.productId ?? null,
    sku: item.product?.sku ?? null,
    name: item.name,
    productName: item.name,
    qty: item.qty,
    unitPrice: item.unitPrice,
    sellerId: item.sellerId ?? null,
    imageUrl,
    image: imageUrl,
  };
}

export function serializeCustomerOrder<T extends { items: OrderItemSerializeSource[] }>(order: T) {
  return {
    ...order,
    items: order.items.map(serializeCustomerOrderItem),
  };
}
