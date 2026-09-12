/**
 * Rewrite stored Railway upload URLs to the public apex proxy.
 *
 * Curl-verified 2026-09-12 against product
 * 518992fa-c11b-4ca5-8113-18e5a1e6c6db.png: apex and Railway both 200 PNG
 * (1_782_491 bytes, same etag). Only /api/v1/uploads/* is rewritten.
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

export function rewritePublicUploadUrls<T extends { url?: string | null }>(
  images: T[] | null | undefined,
): T[] | undefined {
  if (!images) return undefined;
  return images.map((img) => {
    const next = rewritePublicUploadUrl(img?.url);
    if (next == null || next === img.url) return img;
    return { ...img, url: next };
  });
}
