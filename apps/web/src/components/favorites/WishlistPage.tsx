'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { RecentlyViewedStrip } from '@/components/RecentlyViewedStrip';
import { WishlistRow } from '@/components/favorites/WishlistRow';
import { useFavorites } from '@/components/favorites/FavoritesProvider';
import { showStorefrontToast } from '@/lib/storefront-toast';
import {
  isWishlistOutOfStock,
  wishlistEmptyCopy,
  wishlistErrorMessage,
  wishlistGuestBanner,
  wishlistHeading,
  type WishlistProductLike,
} from '@/lib/wishlist-ui';
import { ACCOUNT_HUB_TITLE } from '@/lib/account-menu';
import { isDemoCatalogProduct } from '@/lib/demo-catalog';

export function WishlistPage() {
  const { items, count, loggedIn, loading, refresh, remove } = useFavorites();
  const [err, setErr] = useState('');
  const [addingId, setAddingId] = useState('');
  const [addedId, setAddedId] = useState('');

  useEffect(() => {
    void refresh().catch((e) => setErr(wishlistErrorMessage(e, 'list')));
  }, [refresh]);

  const heading = wishlistHeading(count, loggedIn);
  const empty = wishlistEmptyCopy(loggedIn);
  const guestBanner = wishlistGuestBanner();
  const showEmpty = !loading && items.length === 0;
  const showGuestBanner = !loggedIn && items.length > 0;

  async function addToCart(product: WishlistProductLike) {
    const id = String(product.id || '');
    if (!id || isDemoCatalogProduct(product) || isWishlistOutOfStock(product) || addingId) return;
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
    <div className="wishlist-page account-hub">
      <p className="account-hub-back">
        <Link href="/conta">← {ACCOUNT_HUB_TITLE}</Link>
      </p>
      <header className="account-hub-head">
        <p className="sf-catalog-kicker">Lista de desejos</p>
        <h1 className="account-hub-title">{heading.title}</h1>
        <p className="account-hub-sub muted">{heading.subtitle}</p>
      </header>

      {err ? <div className="alert">{err}</div> : null}

      {showGuestBanner ? (
        <div className="wishlist-guest-banner">
          <p className="wishlist-guest-banner-title">{guestBanner.title}</p>
          <p className="muted">{guestBanner.body}</p>
          <Link className="btn" href={guestBanner.ctaHref}>
            {guestBanner.ctaLabel}
          </Link>
        </div>
      ) : null}

      {loading && items.length === 0 ? (
        <p className="muted" style={{ margin: '12px 0 20px' }}>
          Carregando salvos…
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

      {!showEmpty && items.length > 0 ? (
        <div className="wishlist-list">
          {items.map((item) => (
            <WishlistRow
              key={item.id}
              item={item}
              adding={addingId === item.productId}
              added={addedId === item.productId}
              onAddToCart={() => addToCart(item.product)}
              onRemove={() => {
                void remove(item.productId);
              }}
            />
          ))}
        </div>
      ) : null}

      <RecentlyViewedStrip />
    </div>
  );
}
