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
