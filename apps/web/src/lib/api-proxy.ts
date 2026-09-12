/**
 * Same-origin API proxy helpers (web → Railway Nest).
 * Browser calls /api/v1/*; Next forwards to API_PROXY_TARGET (or NEXT_PUBLIC_API_URL host).
 */

/** Strip trailing slash and optional /api/v1 so we never double the prefix. */
export function normalizeProxyOrigin(raw: string): string {
  const cleaned = raw.trim().replace(/\/+$/, '');
  if (!cleaned) return 'http://localhost:3001';
  return cleaned.replace(/\/api\/v1$/i, '') || 'http://localhost:3001';
}

/**
 * Upstream origin only (no /api/v1).
 * Prefer API_PROXY_TARGET; else derive from NEXT_PUBLIC_API_URL.
 */
export function resolveApiProxyTarget(): string {
  const explicit = (process.env.API_PROXY_TARGET || '').trim();
  if (explicit) return normalizeProxyOrigin(explicit);
  const pub = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1').trim();
  return normalizeProxyOrigin(pub);
}

/** Build full upstream URL for /api/v1/<path><search>. */
export function buildUpstreamUrl(pathParts: string[] | undefined, search = ''): string {
  const origin = resolveApiProxyTarget();
  const path = (pathParts || [])
    .map((p) => encodeURIComponent(decodeURIComponent(p)))
    .join('/');
  const suffix = path ? `/${path}` : '';
  const q = search && search.startsWith('?') ? search : search ? `?${search}` : '';
  return `${origin}/api/v1${suffix}${q}`;
}

/**
 * Host-only cookie for the storefront: drop Domain so Set-Cookie binds to
 * lojasschimitz.com.br (not the Railway host). SameSite=None → Lax once same-site.
 */
export function rewriteSetCookieForSameOrigin(setCookie: string): string {
  const parts = setCookie.split(';').map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  for (const part of parts) {
    if (/^domain=/i.test(part)) continue;
    if (/^samesite=none$/i.test(part)) {
      out.push('SameSite=Lax');
      continue;
    }
    out.push(part);
  }
  return out.join('; ');
}

export function rewriteSetCookieHeaders(headers: string[]): string[] {
  return headers.map(rewriteSetCookieForSameOrigin);
}

/**
 * Browser base URL: same-origin /api/v1 outside localhost so HttpOnly cookies work.
 * Local keeps NEXT_PUBLIC_API_URL (default localhost:3001) — dual-mode refresh unchanged.
 */
export function getBrowserApiBase(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
    }
    return '/api/v1';
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
}
