/**
 * Mobile speed (Improvement 3): responsive, compressed variants of OUR uploaded photos.
 *
 * Before: every <img> pointed at the original upload (banners were 640–830 KB PNGs) and the
 * `sizes` attribute had no `srcSet` to choose from, so phones downloaded desktop-size PNGs.
 * Now: same <img> element, same layout/CSS — only a `srcSet` of `/_next/image` variants
 * (WebP, resized by the Next.js optimizer already running in the web service) is added.
 *
 * Scope: only `/api/v1/uploads/*` on our own hosts (apex, www, Railway API host, or relative).
 * Anything else (external URLs, SVG, GIF, data:) is returned unchanged.
 * Kill switch: NEXT_PUBLIC_DISABLE_IMAGE_OPTIMIZER=1 at build time → originals everywhere.
 */

const OWN_HOSTS = new Set([
  'lojasschimitz.com.br',
  'www.lojasschimitz.com.br',
  'lojas-schimitz-production.up.railway.app',
  'localhost',
  '127.0.0.1',
]);

/** Widths Next.js accepts by default (imageSizes ∪ deviceSizes). Others are rejected with 400. */
export const NEXT_IMAGE_WIDTHS = [16, 32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840] as const;

export const IMAGE_WIDTHS = {
  /** product cards: ~48vw on phones, 240px desktop */
  card: [256, 384, 640, 828],
  /** full-width home banners */
  banner: [640, 828, 1080, 1200, 1920],
  /** hero / editorial stage product photo (≤ 420px wide) */
  stage: [384, 640, 828, 1080],
  /** PDP main gallery photo (100vw phones, 480px desktop) */
  gallery: [640, 828, 1080, 1200],
  /** small thumbnails (80px) */
  thumb: [128, 256],
} as const;

const OPTIMIZABLE_EXT = /\.(png|jpe?g|webp|avif)$/i;

function disabled(): boolean {
  return String(process.env.NEXT_PUBLIC_DISABLE_IMAGE_OPTIMIZER || '') === '1';
}

/** `/api/v1/uploads/<file>` when `url` is one of our optimizable uploads, else null. */
export function ownUploadPath(url: string | null | undefined): string | null {
  if (!url) return null;
  const raw = String(url).trim();
  if (!raw || raw.startsWith('data:') || raw.startsWith('blob:')) return null;
  let u: URL;
  try {
    u = new URL(raw, 'https://lojasschimitz.com.br');
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const relative = raw.startsWith('/') && !raw.startsWith('//');
  if (!relative && !OWN_HOSTS.has(u.hostname.toLowerCase())) return null;
  const path = u.pathname;
  if (!path.startsWith('/api/v1/uploads/') || path.includes('..') || path.includes('%2e')) return null;
  const file = path.slice('/api/v1/uploads/'.length);
  if (!file || file.includes('/') || !OPTIMIZABLE_EXT.test(file)) return null;
  return path;
}

export function nextImageUrl(path: string, width: number, quality = 75): string {
  return `/_next/image?url=${encodeURIComponent(path)}&w=${width}&q=${quality}`;
}

export type ResponsiveImageProps = { src: string; srcSet?: string };

/**
 * Props to spread on an <img>: keeps `src` as the original (fallback for very old browsers),
 * adds `srcSet` with width descriptors so the browser picks the smallest adequate WebP.
 */
export function responsiveImageProps(
  url: string | null | undefined,
  widths: readonly number[],
  quality = 75,
): ResponsiveImageProps {
  const src = url ? String(url) : '';
  if (disabled()) return { src };
  const path = ownUploadPath(src);
  if (!path) return { src };
  const allowed = widths.filter((w) => (NEXT_IMAGE_WIDTHS as readonly number[]).includes(w));
  if (!allowed.length) return { src };
  const srcSet = allowed.map((w) => `${nextImageUrl(path, w, quality)} ${w}w`).join(', ');
  return { src, srcSet };
}

/** Editorial stage LCP photo (.id-lcp is `width: min(100%, 320px)`). Shared with the preload in app/page.tsx. */
export const STAGE_IMG_SIZES = '320px';
/** Floor reflection under it (`width: min(78%, 260px)`) — resolves to the same variant, so one download. */
export const REFLECT_IMG_SIZES = '260px';
