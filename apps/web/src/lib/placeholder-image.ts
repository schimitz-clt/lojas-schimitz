/**
 * Shared admin/storefront detection for empty + demo placeholder hosts.
 * Small additive set: placehold.co / placehold.it / via.placeholder.com
 * and empty / junk tokens. Does not fetch the URL.
 */

const PLACEHOLDER_HOSTS = new Set([
  'placehold.co',
  'www.placehold.co',
  'placehold.it',
  'www.placehold.it',
  'via.placeholder.com',
  'placeholder.com',
  'www.placeholder.com',
]);

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** True when the URL is a known demo/placeholder host (not merely empty). */
export function isPlaceholderImageUrl(url?: string | null): boolean {
  const t = typeof url === 'string' ? url.trim() : '';
  if (!t) return false;
  const lower = t.toLowerCase();
  if (lower === 'null' || lower === 'undefined' || lower === '#' || lower === 'about:blank') {
    return true;
  }
  const host = hostnameOf(t);
  if (host) {
    if (PLACEHOLDER_HOSTS.has(host)) return true;
    if (host.endsWith('.placehold.co') || host.endsWith('.placehold.it')) return true;
    return false;
  }
  return /placehold\.co|placehold\.it|via\.placeholder\.com/i.test(t);
}

/** Empty/whitespace or placeholder host — treat as missing photo. */
export function isMissingOrPlaceholderImage(url?: string | null): boolean {
  const t = typeof url === 'string' ? url.trim() : '';
  if (!t) return true;
  return isPlaceholderImageUrl(t);
}
