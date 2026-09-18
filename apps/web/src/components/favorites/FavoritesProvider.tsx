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
import { api, currentUser, ensureHydratedSession, isUnauthorizedError } from '@/lib/api';
import { showStorefrontToast } from '@/lib/storefront-toast';
import {
  FAVORITES_EVENT,
  favoriteProductIds,
  parseFavoriteList,
  wishlistAddToast,
  wishlistAlreadyToast,
  wishlistErrorMessage,
  wishlistNeedLoginToast,
  wishlistRemoveToast,
  type WishlistItem,
} from '@/lib/wishlist-ui';

type ToggleResult = { inList: boolean; needLogin?: boolean; message: string };

type FavoritesApi = {
  items: WishlistItem[];
  count: number;
  loading: boolean;
  loggedIn: boolean;
  has: (productId?: string | null) => boolean;
  refresh: () => Promise<void>;
  add: (productId: string) => Promise<ToggleResult>;
  remove: (productId: string) => Promise<ToggleResult>;
  toggle: (productId: string) => Promise<ToggleResult>;
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

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  const refresh = useCallback(async () => {
    const user = await ensureHydratedSession();
    setLoggedIn(Boolean(user));
    if (!user) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const data = await api<unknown>('/favorites');
      setItems(parseFavoriteList(data));
    } catch (err) {
      if (isUnauthorizedError(err)) {
        setLoggedIn(false);
        setItems([]);
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
    return () => window.removeEventListener(FAVORITES_EVENT, onFav);
  }, [refresh]);

  const value = useMemo<FavoritesApi>(() => {
    const ids = new Set(favoriteProductIds(items));
    const add = async (productId: string): Promise<ToggleResult> => {
      if (!currentUser()) {
        const message = wishlistNeedLoginToast();
        showStorefrontToast({
          message,
          href: '/entrar?next=/favoritos',
          hrefLabel: 'Entrar',
          tone: 'warn',
        });
        return { inList: false, needLogin: true, message };
      }
      try {
        await api('/favorites', { method: 'POST', body: JSON.stringify({ productId }) });
        await refresh();
        const message = wishlistAddToast();
        showStorefrontToast({ message, href: '/favoritos', hrefLabel: 'Ver favoritos' });
        return { inList: true, message };
      } catch (err) {
        const message = wishlistErrorMessage(err, 'add');
        if (message === wishlistAlreadyToast()) {
          await refresh();
          showStorefrontToast({ message, href: '/favoritos', hrefLabel: 'Ver favoritos' });
          return { inList: true, message };
        }
        showStorefrontToast({
          message,
          href: message === wishlistNeedLoginToast() ? '/entrar?next=/favoritos' : undefined,
          hrefLabel: message === wishlistNeedLoginToast() ? 'Entrar' : undefined,
          tone: 'warn',
        });
        return { inList: ids.has(productId), needLogin: message === wishlistNeedLoginToast(), message };
      }
    };
    const remove = async (productId: string): Promise<ToggleResult> => {
      if (!currentUser()) {
        const message = wishlistNeedLoginToast();
        showStorefrontToast({
          message,
          href: '/entrar?next=/favoritos',
          hrefLabel: 'Entrar',
          tone: 'warn',
        });
        return { inList: false, needLogin: true, message };
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
      toggle: async (productId) => {
        if (ids.has(productId)) return remove(productId);
        return add(productId);
      },
    };
  }, [items, loading, loggedIn, refresh]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesApi {
  return useContext(FavoritesContext) ?? NOOP;
}
