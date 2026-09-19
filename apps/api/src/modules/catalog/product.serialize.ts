/**
 * Public catalog product shape.
 * Cart already exposes flat `stock` + `image`; list/detail must match that source
 * (inventory available qty + primary ProductImage.url) so clients aren't stuck with nulls.
 * Railway /api/v1/uploads URLs are rewritten to the public apex (curl-verified).
 */

import { rewritePublicUploadUrl, rewritePublicUploadUrls } from '../../common/public-upload-url';
import { availableQty } from '../inventory/inventory.math';

export type InventoryLike = {
  qtyOnHand: number;
  qtyReserved: number;
} | null | undefined;

export type ImageLike = {
  url?: string | null;
  position?: number;
};

/** Available units: max(0, onHand − reserved). null when inventory row is missing (Sob consulta). */
export function availableStock(inventory: InventoryLike): number | null {
  if (!inventory) return null;
  return availableQty(inventory.qtyOnHand, inventory.qtyReserved);
}

/** Primary image URL — same source as cart (`images[0].url`). */
export function primaryImageUrl(images: ImageLike[] | null | undefined): string | null {
  if (!images?.length) return null;
  const sorted = [...images].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  for (const img of sorted) {
    const url = typeof img?.url === 'string' ? img.url.trim() : '';
    if (url) return url;
  }
  return null;
}

/** Public inventory: available qty only — never qtyOnHand / qtyReserved (F12). */
export function publicInventoryView(
  inventory: InventoryLike,
): { available: number | null } | null | undefined {
  if (inventory === undefined) return undefined;
  if (inventory == null) return null;
  return { available: availableStock(inventory) };
}

/**
 * Enrich a Prisma product (with images + inventory includes) with flat fields
 * expected by public clients: stock, image, imageUrl.
 * Nested inventory on the public API is `{ available }` only.
 */
export function serializePublicProduct<T extends Record<string, unknown>>(product: T): T & {
  stock: number | null;
  image: string | null;
  imageUrl: string | null;
} {
  const rawImages = (product as { images?: ImageLike[] }).images;
  const images = rewritePublicUploadUrls(rawImages);
  const inventory = (product as { inventory?: InventoryLike }).inventory;
  const image = rewritePublicUploadUrl(primaryImageUrl(images ?? rawImages));
  const rawSeller = (product as { seller?: Record<string, unknown> | null }).seller;
  const seller =
    rawSeller && typeof rawSeller === 'object'
      ? {
          id: rawSeller.id,
          name: rawSeller.name,
          slug: rawSeller.slug,
        }
      : rawSeller;
  const publicInventory = publicInventoryView(inventory);
  return {
    ...product,
    ...(images ? { images } : {}),
    ...(rawSeller !== undefined ? { seller } : {}),
    ...(inventory !== undefined ? { inventory: publicInventory } : {}),
    stock: availableStock(inventory),
    image,
    imageUrl: image,
  };
}

export function serializePublicProducts<T extends Record<string, unknown>>(items: T[]) {
  return items.map(serializePublicProduct);
}
