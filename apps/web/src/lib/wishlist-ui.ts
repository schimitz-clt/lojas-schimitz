/**
 * Wishlist / Salvos display helpers. Server Favorite is the authority when logged in.
 * Guest hearts may live in localStorage (see wishlist-guest.ts) until login sync.
 * No invented stock — cards reuse live product fields from GET /favorites.
 */

import { loginNextPath } from '@/lib/order-recovery';
import { pixPrice, toNumber } from '@/lib/pricing';
import { resolveProductImageUrl, resolveProductStock } from '@/lib/product-media';

export const FAVORITES_EVENT = 'sch-favorites-updated';
export const FAVORITES_MAX_BADGE = 99;
export const WISHLIST_PATH = '/conta/salvos';
export const WISHLIST_LEGACY_PATH = '/favoritos';

export type WishlistProductLike = {
  id?: string | null;
  name?: string | null;
  slug?: string | null;
  price?: number | string | null;
  compareAtPrice?: number | string | null;
  images?: { url?: string | null; position?: number }[] | null;
  image?: string | null;
  imageUrl?: string | null;
  stock?: number | null;
  inventory?: { qtyOnHand?: number; qtyReserved?: number; available?: number | null } | null;
  category?: { slug?: string | null; name?: string | null } | null;
  seller?: { id?: string; name?: string | null; slug?: string | null } | null;
  badge?: string | null;
  isDemo?: boolean | null;
};

export type WishlistItem = {
  id: string;
  productId: string;
  product: WishlistProductLike;
};

export type WishlistEmptyCopy = {
  title: string;
  body: string;
  ctaHref: string;
  ctaLabel: string;
};

function asText(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export function wishlistLoginHref(nextPath = WISHLIST_PATH): string {
  return loginNextPath(nextPath);
}

export function wishlistProductHref(product: WishlistProductLike | null | undefined): string {
  const slug = asText(product?.slug);
  return slug ? `/produto/${encodeURIComponent(slug)}` : '/produtos';
}

/** Empty state — logged-out vs empty list. */
export function wishlistEmptyCopy(loggedIn: boolean): WishlistEmptyCopy {
  if (!loggedIn) {
    return {
      title: 'Entre para ver seus salvos',
      body: 'A lista de desejos fica na sua conta Lojas Schimitz. Visitante: o coração pode marcar neste aparelho; ao entrar, sincronizamos na conta.',
      ctaHref: wishlistLoginHref(),
      ctaLabel: 'Entrar',
    };
  }
  return {
    title: 'Nenhum produto salvo',
    body: 'Toque no coração do produto para guardar aqui. Só entram itens reais do catálogo.',
    ctaHref: '/produtos',
    ctaLabel: 'Ver produtos',
  };
}

export function wishlistHeading(count: number, loggedIn: boolean): { title: string; subtitle: string } {
  if (!loggedIn) {
    if (count > 0) {
      return {
        title: 'Salvos',
        subtitle:
          count === 1
            ? '1 produto neste aparelho — entre para guardar na conta.'
            : `${count} produtos neste aparelho — entre para guardar na conta.`,
      };
    }
    return { title: 'Salvos', subtitle: 'Entre na conta para ver a lista de desejos.' };
  }
  if (count <= 0) {
    return { title: 'Salvos', subtitle: 'Nenhum item na lista de desejos.' };
  }
  return {
    title: 'Salvos',
    subtitle: count === 1 ? '1 produto salvo' : `${count} produtos salvos`,
  };
}

export function wishlistGuestBanner(): { title: string; body: string; ctaHref: string; ctaLabel: string } {
  return {
    title: 'Só neste aparelho',
    body: 'Estes itens ainda não estão na conta. Entre para gravar a lista de desejos no servidor.',
    ctaHref: wishlistLoginHref(),
    ctaLabel: 'Entrar e guardar',
  };
}

export function formatWishlistBadge(count: number): string | null {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (n <= 0) return null;
  if (n > FAVORITES_MAX_BADGE) return `${FAVORITES_MAX_BADGE}+`;
  return String(n);
}

export function wishlistAddToast(): string {
  return 'Salvo na lista de desejos.';
}

export function wishlistRemoveToast(): string {
  return 'Removido dos salvos.';
}

export function wishlistNeedLoginToast(): string {
  return 'Entre para guardar os salvos na conta.';
}

export function wishlistGuestSavedToast(): string {
  return 'Marcado neste aparelho. Entre para guardar na conta.';
}

export function wishlistAlreadyToast(): string {
  return 'Este produto já está nos salvos.';
}

export function wishlistAddToCartLabel(opts: {
  outOfStock: boolean;
  adding: boolean;
  added: boolean;
  demo?: boolean;
}): string {
  if (opts.demo) return 'Não disponível';
  if (opts.outOfStock) return 'Indisponível';
  if (opts.adding) return 'Adicionando…';
  if (opts.added) return '✓ Na sacola';
  return 'Adicionar à sacola';
}

export function wishlistRemoveLabel(): string {
  return 'Remover';
}

export function wishlistToggleLabel(inList: boolean): string {
  return inList ? 'Salvo' : 'Salvar';
}

/** Map API / network errors to Portuguese UI copy. */
export function wishlistErrorMessage(err: unknown, action: 'add' | 'remove' | 'list'): string {
  const raw = err instanceof Error ? err.message : String(err || '');
  const msg = raw.toLowerCase();
  if (
    msg.includes('token') ||
    msg.includes('não autorizado') ||
    msg.includes('nao autorizado') ||
    msg.includes('unauthorized') ||
    msg.includes('faça login') ||
    msg.includes('faca login')
  ) {
    return wishlistNeedLoginToast();
  }
  if (action === 'add' && (msg.includes('já está') || msg.includes('ja esta') || msg.includes('conflict'))) {
    return wishlistAlreadyToast();
  }
  if (action === 'remove' && (msg.includes('não encontrado') || msg.includes('nao encontrado'))) {
    return 'Este item já não estava nos salvos.';
  }
  if (action === 'list') return raw || 'Não foi possível carregar os salvos.';
  return raw || 'Não foi possível atualizar os salvos.';
}

export function isWishlistOutOfStock(product: WishlistProductLike | null | undefined): boolean {
  if (!product) return false;
  const stock = resolveProductStock(product);
  return stock != null && stock <= 0;
}

function parseProduct(raw: unknown): WishlistProductLike | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = asText(o.id);
  const slug = asText(o.slug);
  const name = asText(o.name);
  if (!id || !slug || !name) return null;
  const category =
    o.category && typeof o.category === 'object'
      ? (o.category as WishlistProductLike['category'])
      : null;
  const seller =
    o.seller && typeof o.seller === 'object' ? (o.seller as WishlistProductLike['seller']) : null;
  return {
    id,
    slug,
    name,
    price: (o.price as number | string | null) ?? null,
    compareAtPrice: (o.compareAtPrice as number | string | null) ?? null,
    images: Array.isArray(o.images) ? (o.images as WishlistProductLike['images']) : undefined,
    image: asText(o.image) || null,
    imageUrl: asText(o.imageUrl) || asText(o.image) || null,
    stock: typeof o.stock === 'number' ? o.stock : o.stock === null ? null : undefined,
    inventory:
      o.inventory && typeof o.inventory === 'object'
        ? (o.inventory as WishlistProductLike['inventory'])
        : undefined,
    category: category || null,
    seller: seller || null,
    badge: asText(o.badge) || null,
    isDemo: o.isDemo === true,
  };
}

/** Sanitize GET /favorites payload. */
export function parseFavoriteList(raw: unknown): WishlistItem[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out: WishlistItem[] = [];
  const seen = new Set<string>();
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const product = parseProduct(o.product);
    const productId = asText(o.productId) || asText(product?.id);
    const id = asText(o.id) || productId;
    if (!product || !productId || seen.has(productId)) continue;
    seen.add(productId);
    out.push({ id, productId, product });
  }
  return out;
}

export function favoriteProductIds(items: WishlistItem[]): string[] {
  return parseFavoriteList(items).map((x) => x.productId);
}

export function wishlistProductImage(product: WishlistProductLike): string {
  return resolveProductImageUrl(product);
}

export function wishlistMoney(price: number | string | null | undefined): string {
  const n = toNumber(price);
  if (!(n > 0)) return '';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function wishlistPriceLabel(product: WishlistProductLike): string {
  return wishlistMoney(product.price);
}

export function wishlistPixLabel(product: WishlistProductLike): string | null {
  const n = toNumber(product.price);
  if (!(n > 0)) return null;
  return `${wishlistMoney(pixPrice(n))} no PIX`;
}

export function notifyFavoritesUpdated(): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new Event(FAVORITES_EVENT));
  } catch {
    /* ignore */
  }
}

export function isWishlistPath(pathname: string): boolean {
  const p = (pathname || '').split('?')[0] || '';
  return p === WISHLIST_PATH || p.startsWith(`${WISHLIST_PATH}/`) || p === WISHLIST_LEGACY_PATH || p.startsWith(`${WISHLIST_LEGACY_PATH}/`);
}
