/**
 * Storefront share-card image guard.
 * Display only — does not write store settings or upload a replacement image.
 */

const IMAGE_EXT = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i;

export type TwitterCard = 'summary' | 'summary_large_image';

export type ShareImageMetadata = {
  imageUrl: string | null;
  twitterCard: TwitterCard;
};

function parseHttpUrl(value: string, base?: string): URL | null {
  try {
    const url = base ? new URL(value, base) : new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url;
  } catch {
    return null;
  }
}

function siteBase(origin: string): string {
  const trimmed = (origin || '').trim();
  if (!trimmed) return 'https://lojasschimitz.com.br/';
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

/** Path `/` (the site root, or any bare origin) is not a share image. */
export function isSiteRootUrl(raw: string, origin: string): boolean {
  const value = (raw || '').trim();
  if (!value) return false;
  const url = parseHttpUrl(value, siteBase(origin));
  if (!url) return false;
  return url.pathname === '/' || url.pathname === '';
}

/** True when the URL path looks like an image file (extension), not an HTML page. */
export function isImageUrl(raw: string, origin: string): boolean {
  const value = (raw || '').trim();
  if (!value) return false;
  const absolute = /^https?:\/\//i.test(value);
  const url = absolute ? parseHttpUrl(value) : parseHttpUrl(value, siteBase(origin));
  if (!url) return false;
  return IMAGE_EXT.test(url.pathname);
}

/**
 * URL to emit as og:image / twitter:image, or null when settings point at the
 * site root or at something that is not an image.
 */
export function shareImageUrl(ogImageUrl: string | null | undefined, origin: string): string | null {
  const value = typeof ogImageUrl === 'string' ? ogImageUrl.trim() : '';
  if (!value) return null;
  if (isSiteRootUrl(value, origin)) return null;
  if (!isImageUrl(value, origin)) return null;
  return value;
}

export function shareImageMetadata(
  ogImageUrl: string | null | undefined,
  origin: string,
): ShareImageMetadata {
  const imageUrl = shareImageUrl(ogImageUrl, origin);
  return {
    imageUrl,
    twitterCard: imageUrl ? 'summary_large_image' : 'summary',
  };
}
