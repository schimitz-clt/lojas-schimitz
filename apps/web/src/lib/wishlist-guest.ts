/**
 * Guest wishlist — device-only until login. Server Favorite is source of truth after sync.
 * Snapshots are catalog fields from the card/PDP the user actually saw. No fake products.
 */

import { resolveProductImageUrl } from '@/lib/product-media';
import { toNumber } from '@/lib/pricing';
import type { WishlistItem, WishlistProductLike } from '@/lib/wishlist-ui';

export const GUEST_WISHLIST_KEY = 'sch_wishlist_guest_v1';
export const GUEST_WISHLIST_MAX = 40;
export const GUEST_WISHLIST_EVENT = 'sch-wishlist-guest-updated';

export type GuestWishlistSnap = {
  id: string;
  slug: string;
  name: string;
  price: number;
  compareAtPrice: number | null;
  image: string | null;
  savedAt: number;
};

function asText(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function optionalMoney(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = toNumber(v as number | string);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function snapshotGuestWishlistProduct(
  p: WishlistProductLike | null | undefined,
  savedAt = 0,
): GuestWishlistSnap | null {
  if (!p) return null;
  const id = asText(p.id);
  const slug = asText(p.slug);
  const name = asText(p.name);
  if (!id || !slug || !name) return null;
  const image = resolveProductImageUrl(p);
  const at = Number.isFinite(savedAt) && savedAt > 0 ? savedAt : 0;
  return {
    id,
    slug,
    name,
    price: toNumber(p.price),
    compareAtPrice: optionalMoney(p.compareAtPrice),
    image: image || null,
    savedAt: at,
  };
}

function parseOne(raw: unknown): GuestWishlistSnap | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const savedAt = typeof o.savedAt === 'number' && Number.isFinite(o.savedAt) ? o.savedAt : 0;
  return snapshotGuestWishlistProduct(
    {
      id: asText(o.id),
      slug: asText(o.slug),
      name: asText(o.name),
      price: o.price as number | string | null,
      compareAtPrice: o.compareAtPrice as number | string | null,
      image: asText(o.image) || null,
      imageUrl: asText(o.image) || null,
    },
    savedAt,
  );
}

export function parseGuestWishlist(raw: unknown): GuestWishlistSnap[] {
  const arr = Array.isArray(raw) ? raw : [];
  const parsed: GuestWishlistSnap[] = [];
  for (const item of arr) {
    const snap = parseOne(item);
    if (snap) parsed.push(snap);
  }
  parsed.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  const out: GuestWishlistSnap[] = [];
  const seen = new Set<string>();
  for (const snap of parsed) {
    if (seen.has(snap.id)) continue;
    seen.add(snap.id);
    out.push(snap);
    if (out.length >= GUEST_WISHLIST_MAX) break;
  }
  return out;
}

export function guestWishlistHas(list: GuestWishlistSnap[], productId: string): boolean {
  const id = asText(productId);
  return Boolean(id) && parseGuestWishlist(list).some((x) => x.id === id);
}

export function addGuestWishlistItem(
  list: GuestWishlistSnap[],
  product: WishlistProductLike,
  now = Date.now(),
): GuestWishlistSnap[] {
  const snap = snapshotGuestWishlistProduct(product, now);
  if (!snap) return parseGuestWishlist(list);
  const rest = parseGuestWishlist(list).filter((x) => x.id !== snap.id);
  return parseGuestWishlist([{ ...snap, savedAt: now }, ...rest]);
}

export function removeGuestWishlistItem(list: GuestWishlistSnap[], productId: string): GuestWishlistSnap[] {
  const id = asText(productId);
  return parseGuestWishlist(list).filter((x) => x.id !== id);
}

export function guestWishlistIds(list: GuestWishlistSnap[]): string[] {
  return parseGuestWishlist(list).map((x) => x.id);
}

/** After login, POST only IDs the server list does not already have. */
export function guestIdsToSync(guestIds: string[], serverIds: string[]): string[] {
  const have = new Set(serverIds.filter(Boolean));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of guestIds) {
    const id = typeof raw === 'string' ? raw.trim() : '';
    if (!id || have.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function guestSnapsToWishlistItems(list: GuestWishlistSnap[]): WishlistItem[] {
  return parseGuestWishlist(list).map((snap) => ({
    id: `guest:${snap.id}`,
    productId: snap.id,
    product: {
      id: snap.id,
      slug: snap.slug,
      name: snap.name,
      price: snap.price,
      compareAtPrice: snap.compareAtPrice,
      image: snap.image,
      imageUrl: snap.image,
    },
  }));
}

export function readGuestWishlist(): GuestWishlistSnap[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(GUEST_WISHLIST_KEY);
    if (!raw) return [];
    return parseGuestWishlist(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function writeGuestWishlist(list: GuestWishlistSnap[]): GuestWishlistSnap[] {
  const next = parseGuestWishlist(list);
  if (typeof window === 'undefined') return next;
  try {
    if (next.length) window.localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(next));
    else window.localStorage.removeItem(GUEST_WISHLIST_KEY);
  } catch {
    /* quota / private mode */
  }
  try {
    window.dispatchEvent(new Event(GUEST_WISHLIST_EVENT));
  } catch {
    /* ignore */
  }
  return next;
}

export function clearGuestWishlist(): GuestWishlistSnap[] {
  return writeGuestWishlist([]);
}
