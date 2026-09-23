/**
 * Delivery hints for next/image.
 * Home banners on the live store are multi-megabyte PNGs; the optimizer
 * serves a viewport-sized WebP instead. Hosts outside the store upload
 * allow-list stay as plain <img> bytes (no open image proxy).
 */

/** WebP quality for the hero carousel. Source files are full-size PNGs. */
export const HOME_BANNER_IMAGE_QUALITY = 60;

/** Mobile frame is the viewport; the desktop column caps near the 1280px wrap. */
export const HOME_BANNER_IMAGE_SIZES = '(max-width: 720px) 100vw, 1280px';

export const PRODUCT_CARD_IMAGE_QUALITY = 60;

export const PRODUCT_CARD_IMAGE_SIZES =
  '(max-width: 640px) 48vw, (max-width: 1024px) 33vw, 240px';

/** Hosts the Next image optimizer is allowed to fetch. */
export const STOREFRONT_OPTIMIZED_IMAGE_HOSTS = [
  'lojasschimitz.com.br',
  'www.lojasschimitz.com.br',
  'lojas-schimitz-production.up.railway.app',
] as const;

const OPTIMIZED_HOSTS = new Set<string>(STOREFRONT_OPTIMIZED_IMAGE_HOSTS);

/**
 * next/image only resizes absolute URLs on the store upload hosts.
 * Root-relative paths are the localhost upload proxy (not files in /public).
 * SVGs and data/blob URLs are not photos.
 */
export function storefrontImageUnoptimized(src: string): boolean {
  const raw = src.trim();
  if (!raw) return true;
  if (raw.startsWith('data:') || raw.startsWith('blob:')) return true;
  if (/\.svg(?:$|\?)/i.test(raw)) return true;
  if (raw.startsWith('/') && !raw.startsWith('//')) return true;
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return !OPTIMIZED_HOSTS.has(host);
  } catch {
    return true;
  }
}
