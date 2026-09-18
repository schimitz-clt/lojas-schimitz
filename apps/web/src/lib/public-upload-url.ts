/**
 * Rewrite stored Railway upload URLs to the public apex proxy.
 *
 * Verified 2026-09-12: GET
 *   https://lojas-schimitz-production.up.railway.app/api/v1/uploads/<id>.png
 * and
 *   https://lojasschimitz.com.br/api/v1/uploads/<id>.png
 * both 200 image/png, same bytes (etag W/"1b32db-1a0871cfdb9").
 * Only /api/v1/uploads/* on that Railway host is rewritten.
 */

export const RAILWAY_UPLOAD_HOST = 'lojas-schimitz-production.up.railway.app';
export const PUBLIC_UPLOAD_ORIGIN = 'https://lojasschimitz.com.br';

export function rewritePublicUploadUrl(url: string | null | undefined): string | null {
  if (url == null) return null;
  const raw = String(url).trim();
  if (!raw) return raw;
  try {
    const u = new URL(raw);
    if (u.hostname.toLowerCase() !== RAILWAY_UPLOAD_HOST) return raw;
    if (!u.pathname.startsWith('/api/v1/uploads/')) return raw;
    const file = u.pathname.slice('/api/v1/uploads/'.length);
    if (!file || file.includes('..')) return raw;
    return `${PUBLIC_UPLOAD_ORIGIN}${u.pathname}${u.search}${u.hash}`;
  } catch {
    return raw;
  }
}

/**
 * On localhost, load apex/Railway uploads through the Next `/api/v1` proxy
 * so the browser is same-origin (CSP + VM egress). Production is unchanged.
 */
export function localizeStorefrontUploadUrl(url: string, pageOrigin?: string): string {
  const origin =
    pageOrigin || (typeof window !== 'undefined' ? window.location.origin : '');
  if (!origin || !url) return url;
  let page: URL;
  try {
    page = new URL(origin);
  } catch {
    return url;
  }
  if (page.hostname !== 'localhost' && page.hostname !== '127.0.0.1') return url;
  try {
    const u = new URL(url, page.origin);
    if (!u.pathname.startsWith('/api/v1/uploads/') || u.pathname.includes('..')) return url;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return url;
  }
}
