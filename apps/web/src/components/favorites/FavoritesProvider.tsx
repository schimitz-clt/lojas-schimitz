'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, currentUser, ensureHydratedSession, isUnauthorizedError, SESSION_UPDATED_EVENT } from '@/lib/api';
import { showStorefrontToast } from '@/lib/storefront-toast';
import {
  FAVORITES_EVENT,
  WISHLIST_PATH,
  favoriteProductIds,
  parseFavoriteList,
  wishlistAddToast,
  wishlistAlreadyToast,
  wishlistErrorMessage,
  wishlistGuestSavedToast,
  wishlistLoginHref,
  wishlistNeedLoginToast,
  wishlistRemoveToast,
  type WishlistItem,
  type WishlistProductLike,
} from '@/lib/wishlist-ui';
import {
  addGuestWishlistItem,
  guestSnapsToWishlistItems,
  readGuestWishlist,
  removeGuestWishlistItem,
  writeGuestWishlist,
  type GuestWishlistSnap,
} from '@/lib/wishlist-guest';

type ToggleResult = { inList: boolean; needLogin?: boolean; message: string };

type FavoritesApi = {
  items: WishlistItem[];
  count: number;
  loading: boolean;
  loggedIn: boolean;
  has: (productId?: string | null) => boolean;
  refresh: () => Promise<void>;
  add: (productId: string, product?: WishlistProductLike | null) => Promise<ToggleResult>;
  remove: (productId: string) => Promise<ToggleResult>;
  toggle: (productId: string, product?: WishlistProductLike | null) => Promise<ToggleResult>;
};

const FavoritesContext = createContext<FavoritesApi | null>(null);

const NOOP: FavoritesApi = {
  items: [],
  count: 0,
  loading: false,
  loggedIn: false,
  has: () => false,
  refresh: async () => undefined,
  add: async () => ({ inList: false, needLogin: true, message: wishlistNeedLoginToast() }),
  remove: async () => ({ inList: false, needLogin: true, message: wishlistNeedLoginToast() }),
  toggle: async () => ({ inList: false, needLogin: true, message: wishlistNeedLoginToast() }),
};

function loginToastHref() {
  return wishlistLoginHref(WISHLIST_PATH);
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  const refresh = useCallback(async () => {
    const user = await ensureHydratedSession();
    setLoggedIn(Boolean(user));
    if (!user) {
      setItems(guestSnapsToWishlistItems(readGuestWishlist()));
      return;
    }
    setLoading(true);
    try {
      const data = await api<unknown>('/favorites');
      let next = parseFavoriteList(data);
      const guest = readGuestWishlist();
      if (guest.length) {
        const serverIds = new Set(favoriteProductIds(next));
        const remaining: GuestWishlistSnap[] = [];
        for (const snap of guest) {
          if (serverIds.has(snap.id)) continue;
          try {
            await api('/favorites', { method: 'POST', body: JSON.stringify({ productId: snap.id }) });
          } catch (err) {
            const message = wishlistErrorMessage(err, 'add');
            if (message === wishlistAlreadyToast()) continue;
            remaining.push(snap);
          }
        }
        writeGuestWishlist(remaining);
        const again = await api<unknown>('/favorites');
        next = parseFavoriteList(again);
      }
      setItems(next);
    } catch (err) {
      if (isUnauthorizedError(err)) {
        setLoggedIn(false);
        setItems(guestSnapsToWishlistItems(readGuestWishlist()));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onFav = () => {
      void refresh();
    };
    window.addEventListener(FAVORITES_EVENT, onFav);
    window.addEventListener(SESSION_UPDATED_EVENT, onFav);
    return () => {
      window.removeEventListener(FAVORITES_EVENT, onFav);
      window.removeEventListener(SESSION_UPDATED_EVENT, onFav);
    };
  }, [refresh]);

  const value = useMemo<FavoritesApi>(() => {
    const ids = new Set(favoriteProductIds(items));
    const add = async (
      productId: string,
      product?: WishlistProductLike | null,
    ): Promise<ToggleResult> => {
      if (!currentUser()) {
        if (product?.id && product.slug && product.name) {
          const next = addGuestWishlistItem(readGuestWishlist(), product);
          writeGuestWishlist(next);
          setItems(guestSnapsToWishlistItems(next));
          const message = wishlistGuestSavedToast();
          showStorefrontToast({
            message,
            href: loginToastHref(),
            hrefLabel: 'Entrar',
            tone: 'warn',
          });
          return { inList: true, needLogin: true, message };
        }
        const message = wishlistNeedLoginToast();
        showStorefrontToast({
          message,
          href: loginToastHref(),
          hrefLabel: 'Entrar',
          tone: 'warn',
        });
        return { inList: false, needLogin: true, message };
      }
      try {
        await api('/favorites', { method: 'POST', body: JSON.stringify({ productId }) });
        await refresh();
        const message = wishlistAddToast();
        showStorefrontToast({ message, href: WISHLIST_PATH, hrefLabel: 'Ver salvos' });
        return { inList: true, message };
      } catch (err) {
        const message = wishlistErrorMessage(err, 'add');
        if (message === wishlistAlreadyToast()) {
          await refresh();
          showStorefrontToast({ message, href: WISHLIST_PATH, hrefLabel: 'Ver salvos' });
          return { inList: true, message };
        }
        showStorefrontToast({
          message,
          href: message === wishlistNeedLoginToast() ? loginToastHref() : undefined,
          hrefLabel: message === wishlistNeedLoginToast() ? 'Entrar' : undefined,
          tone: 'warn',
        });
        return { inList: ids.has(productId), needLogin: message === wishlistNeedLoginToast(), message };
      }
    };
    const remove = async (productId: string): Promise<ToggleResult> => {
      if (!currentUser()) {
        const next = removeGuestWishlistItem(readGuestWishlist(), productId);
        writeGuestWishlist(next);
        setItems(guestSnapsToWishlistItems(next));
        const message = wishlistRemoveToast();
        showStorefrontToast({ message });
        return { inList: false, message };
      }
      try {
        await api(`/favorites/${productId}`, { method: 'DELETE' });
        setItems((cur) => cur.filter((x) => x.productId !== productId));
        await refresh();
        const message = wishlistRemoveToast();
        showStorefrontToast({ message });
        return { inList: false, message };
      } catch (err) {
        const message = wishlistErrorMessage(err, 'remove');
        showStorefrontToast({ message, tone: 'warn' });
        await refresh();
        return { inList: false, message };
      }
    };
    return {
      items,
      count: items.length,
      loading,
      loggedIn,
      has: (productId) => Boolean(productId) && ids.has(String(productId)),
      refresh,
      add,
      remove,
      toggle: async (productId, product) => {
        if (ids.has(productId)) return remove(productId);
        return add(productId, product);
      },
    };
  }, [items, loading, loggedIn, refresh]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesApi {
  return useContext(FavoritesContext) ?? NOOP;
}
