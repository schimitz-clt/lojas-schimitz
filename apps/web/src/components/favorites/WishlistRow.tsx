'use client';

import Link from 'next/link';
import {
  isWishlistOutOfStock,
  wishlistAddToCartLabel,
  wishlistPixLabel,
  wishlistPriceLabel,
  wishlistProductHref,
  wishlistProductImage,
  wishlistRemoveLabel,
  type WishlistItem,
} from '@/lib/wishlist-ui';
import { isDemoCatalogProduct } from '@/lib/demo-catalog';

export function WishlistRow({
  item,
  adding,
  added,
  onAddToCart,
  onRemove,
}: {
  item: WishlistItem;
  adding?: boolean;
  added?: boolean;
  onAddToCart: () => void;
  onRemove: () => void;
}) {
  const product = item.product;
  const href = wishlistProductHref(product);
  const img = wishlistProductImage(product);
  const demo = isDemoCatalogProduct(product);
  const out = isWishlistOutOfStock(product);
  const price = wishlistPriceLabel(product);
  const pix = wishlistPixLabel(product);

  return (
    <article className="wishlist-row">
      <Link href={href} className="wishlist-row-media" aria-label={product.name || 'Produto'}>
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={product.name || ''} width={112} height={112} />
        ) : (
          <span className="wishlist-row-ph" aria-hidden>
            SCHIMITZ
          </span>
        )}
      </Link>
      <div className="wishlist-row-body">
        <Link href={href} className="wishlist-row-title">
          {product.name}
        </Link>
        {price ? <p className="wishlist-row-price">{price}</p> : null}
        {pix ? (
          <p className="wishlist-row-pix">
            {pix} <span className="wishlist-row-pix-tag">5% OFF</span>
          </p>
        ) : null}
        <div className="wishlist-row-actions">
          <button type="button" className="btn" disabled={demo || out || adding} onClick={onAddToCart}>
            {wishlistAddToCartLabel({ outOfStock: out, adding: Boolean(adding), added: Boolean(added), demo })}
          </button>
          <button type="button" className="btn ghost" onClick={onRemove}>
            {wishlistRemoveLabel()}
          </button>
        </div>
      </div>
    </article>
  );
}
