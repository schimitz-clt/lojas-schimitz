/**
 * Favorite row → public wishlist item (same catalog shape as GET /products).
 */

import { serializePublicProduct } from '../catalog/product.serialize';
import { publicSellerShape } from '../sellers/sellers.constants';

export type FavoriteProductLike = Record<string, unknown> & {
  seller?: { id: string; name: string; slug: string; status?: string | null } | null;
};

export type FavoriteRowLike = {
  id: string;
  productId: string;
  createdAt: Date;
  product: FavoriteProductLike;
};

export function serializeFavoriteItem(row: FavoriteRowLike) {
  const seller = row.product.seller;
  const product = serializePublicProduct({
    ...row.product,
    seller: seller ? publicSellerShape(seller) : seller,
  });
  return {
    id: row.id,
    productId: row.productId,
    createdAt: row.createdAt,
    product,
  };
}

export function serializeFavoriteItems(rows: FavoriteRowLike[]) {
  return rows.map(serializeFavoriteItem);
}
