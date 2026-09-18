'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ProductCard, type Product } from '@/components/ProductCard';
import { RecentlyViewedStrip } from '@/components/RecentlyViewedStrip';
import { useFavorites } from '@/components/favorites/FavoritesProvider';
import { showStorefrontToast } from '@/lib/storefront-toast';
import {
  isWishlistOutOfStock,
  wishlistAddToCartLabel,
  wishlistEmptyCopy,
  wishlistErrorMessage,
  wishlistHeading,
  wishlistRemoveLabel,
  type WishlistProductLike,
} from '@/lib/wishlist-ui';

function asProduct(p: WishlistProductLike): Product {
  return {
    id: String(p.id || ''),
    name: String(p.name || ''),
    slug: String(p.slug || ''),
    price: p.price ?? 0,
    compareAtPrice: p.compareAtPrice,
    badge: p.badge,
    images: p.images?.map((img) => ({ url: img.url || '' })),
    image: p.image,
    imageUrl: p.imageUrl,
    stock: p.stock,
    inventory: p.inventory,
    seller: p.seller?.name
      ? { id: p.seller.id || '', name: p.seller.name, slug: p.seller.slug || '' }
      : null,
    category: p.category?.slug
      ? { slug: p.category.slug, name: p.category.name || p.category.slug }
      : null,
  };
}

export default function FavoritosPage() {
  const { items, count, loggedIn, loading, refresh, remove } = useFavorites();
  const [err, setErr] = useState('');
  const [addingId, setAddingId] = useState('');
  const [addedId, setAddedId] = useState('');

  useEffect(() => {
    void refresh().catch((e) => setErr(wishlistErrorMessage(e, 'list')));
  }, [refresh]);

  const heading = wishlistHeading(count, loggedIn);
  const empty = wishlistEmptyCopy(loggedIn);
  const showEmpty = !loading && items.length === 0;

  async function addToCart(product: WishlistProductLike) {
    const id = String(product.id || '');
    if (!id || isWishlistOutOfStock(product) || addingId) return;
    setAddingId(id);
    setErr('');
    try {
      await api('/cart/items', { method: 'POST', body: JSON.stringify({ productId: id, qty: 1 }) });
      setAddedId(id);
      try {
        window.dispatchEvent(new Event('sch-cart-updated'));
      } catch {
        /* ignore */
      }
      showStorefrontToast({
        message: 'Adicionado à sacola.',
        href: '/carrinho',
        hrefLabel: 'Ver sacola',
      });
      window.setTimeout(() => setAddedId((cur) => (cur === id ? '' : cur)), 1800);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Não foi possível adicionar à sacola.';
      setErr(message);
      showStorefrontToast({ message, tone: 'warn' });
    } finally {
      setAddingId('');
    }
  }

  return (
    <div className="wishlist-page" style={{ padding: '24px 0' }}>
      <header className="sf-catalog-head">
        <p className="sf-catalog-kicker">Conta</p>
        <h1 className="sf-catalog-title">{heading.title}</h1>
        <p className="sf-catalog-sub muted">{heading.subtitle}</p>
      </header>

      {err ? <div className="alert">{err}</div> : null}

      {loading && items.length === 0 ? (
        <p className="muted" style={{ margin: '12px 0 20px' }}>
          Carregando favoritos…
        </p>
      ) : null}

      {showEmpty ? (
        <div className="catalog-empty sf-catalog-empty">
          <p className="sf-catalog-empty-title">{empty.title}</p>
          <p className="muted sf-catalog-empty-body">{empty.body}</p>
          <div className="sf-catalog-empty-actions">
            <Link className="btn" href={empty.ctaHref}>
              {empty.ctaLabel}
            </Link>
            <Link className="btn ghost" href="/produtos">
              Ver catálogo
            </Link>
          </div>
        </div>
      ) : null}

      {!showEmpty ? (
        <div className="wishlist-grid">
          {items.map((item) => {
            const product = asProduct(item.product);
            const out = isWishlistOutOfStock(item.product);
            const adding = addingId === item.productId;
            const added = addedId === item.productId;
            return (
              <div key={item.id} className="wishlist-item">
                <ProductCard p={product} />
                <div className="wishlist-item-actions">
                  <button
                    type="button"
                    className="btn"
                    disabled={out || adding}
                    onClick={() => addToCart(item.product)}
                  >
                    {wishlistAddToCartLabel({ outOfStock: out, adding, added })}
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => {
                      void remove(item.productId);
                    }}
                  >
                    {wishlistRemoveLabel()}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <RecentlyViewedStrip />
    </div>
  );
}
