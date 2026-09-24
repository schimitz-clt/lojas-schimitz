/**
 * Storefront share-card image guard.
 * Display only — does not write store settings or upload a replacement image.
 *
 * Live settings have pointed ogImageUrl at the site root (`https://lojasschimitz.com.br/`).
 * That is not an image. Callers that need a tag use resolveShareImage(), which keeps a
 * real absolute image and otherwise falls back to the branded /og-loja.png card.
 */

import { isMissingOrPlaceholderImage, isPlaceholderImageUrl } from './placeholder-image';

const IMAGE_EXT = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i;

/** Static 1200×630 card in apps/web/public. Black/yellow wordmark, no product photo. */
export const BRAND_SHARE_IMAGE_PATH = '/og-loja.png';
export const BRAND_SHARE_IMAGE_WIDTH = 1200;
export const BRAND_SHARE_IMAGE_HEIGHT = 630;
export const BRAND_SHARE_IMAGE_ALT = 'Lojas Schimitz — eletro, celulares e casa em Porto Alegre';

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

export type ResolvedShareImage = {
  url: string;
  alt: string;
  twitterCard: TwitterCard;
  /** True when the branded 1200×630 card is used (dimensions are known). */
  branded: boolean;
};

/** Absolute http(s) URL for a path or URL that already passed the image guard. */
export function absoluteShareImageUrl(
  ogImageUrl: string | null | undefined,
  origin: string,
): string | null {
  const value = shareImageUrl(ogImageUrl, origin);
  if (!value) return null;
  if (isPlaceholderImageUrl(value)) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const url = parseHttpUrl(value, siteBase(origin));
  if (!url) return null;
  return url.toString();
}

export function brandShareImageUrl(origin: string): string {
  return new URL(BRAND_SHARE_IMAGE_PATH, siteBase(origin)).toString();
}

function brandFallback(origin: string): ResolvedShareImage {
  return {
    url: brandShareImageUrl(origin),
    alt: BRAND_SHARE_IMAGE_ALT,
    twitterCard: 'summary_large_image',
    branded: true,
  };
}

/**
 * Share image for the store. Invalid, root, or placeholder settings fall back
 * to the absolute branded card so crawlers never receive the homepage as og:image.
 */
export function resolveShareImage(
  ogImageUrl: string | null | undefined,
  origin: string,
): ResolvedShareImage {
  const configured = absoluteShareImageUrl(ogImageUrl, origin);
  if (!configured) return brandFallback(origin);
  return {
    url: configured,
    alt: BRAND_SHARE_IMAGE_ALT,
    twitterCard: 'summary_large_image',
    branded: false,
  };
}

/**
 * Product og:image. Real catalog photos win, including upload URLs without a
 * file extension. Missing, placeholder, and site-root values use the brand card.
 * Does not invent a product photo.
 */
export function resolveProductShareImage(
  image: string | null | undefined,
  origin: string,
  alt: string,
): ResolvedShareImage {
  const value = typeof image === 'string' ? image.trim() : '';
  if (value && !isMissingOrPlaceholderImage(value) && !isSiteRootUrl(value, origin)) {
    const guarded = absoluteShareImageUrl(value, origin);
    if (guarded) {
      return { url: guarded, alt, twitterCard: 'summary_large_image', branded: false };
    }
    const url = parseHttpUrl(value, siteBase(origin));
    if (
      url &&
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.pathname !== '/' &&
      url.pathname !== ''
    ) {
      return { url: url.toString(), alt, twitterCard: 'summary_large_image', branded: false };
    }
  }
  return brandFallback(origin);
}

export function shareImageTag(image: ResolvedShareImage): {
  url: string;
  alt: string;
  width?: number;
  height?: number;
} {
  const tag: { url: string; alt: string; width?: number; height?: number } = {
    url: image.url,
    alt: image.alt,
  };
  if (image.branded) {
    tag.width = BRAND_SHARE_IMAGE_WIDTH;
    tag.height = BRAND_SHARE_IMAGE_HEIGHT;
  }
  return tag;
}
