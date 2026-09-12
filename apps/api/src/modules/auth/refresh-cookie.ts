/**
 * Refresh token em cookie HttpOnly (modo dual com body).
 *
 * MEGA Phase 9:
 * - Prefer cookie quando presente; body permanece fallback (localhost / legado / mobile).
 * - JSON ainda inclui `refreshToken` por default (compat). Opt-out via
 *   REFRESH_JSON_TOKEN_ENABLED=false + REFRESH_COOKIE_ENABLED (deprecation path).
 * - Web same-origin / Android WebView: credentials include + cookie; não persistir
 *   refresh em localStorage fora de localhost.
 *
 * Cross-origin (ex.: web :3000 → api :3001): cookie exige SameSite=None; Secure e
 * HTTPS, ou proxy same-site. Sem isso o body continua sendo o caminho funcional.
 *
 * Com proxy same-origin no Next (`/api/v1` → Nest), o browser vê cookie no host da loja.
 * O proxy reescreve Set-Cookie (remove Domain; SameSite=None→Lax). REFRESH_COOKIE_DOMAIN
 * no Nest ainda pode ser .lojasschimitz.com.br para acesso direto à API; o proxy remove Domain.
 *
 * CSRF: SameSite=Lax (via proxy) bloqueia POST cross-site com cookie. SameSite=None
 * residual se o cliente falar direto com a API — ver docs/MEGA-PHASE-9-CHECKPOINT.md.
 */

import type { Request, Response } from 'express';

export const REFRESH_COOKIE_NAME = () =>
  (process.env.REFRESH_COOKIE_NAME || 'sch_refresh').trim() || 'sch_refresh';

export function refreshCookieEnabled(): boolean {
  const flag = String(process.env.REFRESH_COOKIE_ENABLED || 'true').toLowerCase().trim();
  if (flag === 'false' || flag === '0' || flag === 'off') return false;
  return true;
}

/**
 * When false AND cookie mode is on, login/register/refresh JSON omits `refreshToken`
 * (clients must use Set-Cookie). Default true — safe compat; do not flip in prod
 * until Set-Cookie path is proven for all clients (web + Android WebView).
 */
export function refreshJsonTokenEnabled(): boolean {
  const flag = String(process.env.REFRESH_JSON_TOKEN_ENABLED || 'true').toLowerCase().trim();
  if (flag === 'false' || flag === '0' || flag === 'off') return false;
  return true;
}

export function shouldOmitRefreshTokenInJson(): boolean {
  return refreshCookieEnabled() && !refreshJsonTokenEnabled();
}

/** Strip refreshToken from auth session payload when deprecation flag is active. */
export function shapeAuthSessionPayload<T extends { refreshToken: string }>(
  tokens: T,
): T | Omit<T, 'refreshToken'> {
  if (!shouldOmitRefreshTokenInJson()) return tokens;
  const { refreshToken: _omit, ...rest } = tokens;
  return rest;
}

function isProdLike() {
  const env = String(process.env.APP_ENV || process.env.NODE_ENV || '').toLowerCase();
  return env === 'production' || env === 'prod' || env === 'staging';
}

/** Secure default: on in prod/staging; override with REFRESH_COOKIE_SECURE=true|false */
export function refreshCookieSecure(): boolean {
  const flag = String(process.env.REFRESH_COOKIE_SECURE || '').toLowerCase().trim();
  if (flag === 'true' || flag === '1' || flag === 'on') return true;
  if (flag === 'false' || flag === '0' || flag === 'off') return false;
  return isProdLike();
}

/** SameSite: lax | strict | none — default none when Secure (cross-site API), else lax */
export function refreshCookieSameSite(): 'lax' | 'strict' | 'none' {
  const raw = String(process.env.REFRESH_COOKIE_SAMESITE || '').toLowerCase().trim();
  if (raw === 'lax' || raw === 'strict' || raw === 'none') return raw;
  return refreshCookieSecure() ? 'none' : 'lax';
}

export function refreshCookieMaxAgeSec(): number {
  const n = Number(process.env.REFRESH_COOKIE_MAX_AGE_SEC || 30 * 24 * 60 * 60);
  return Number.isFinite(n) && n > 60 ? Math.floor(n) : 30 * 24 * 60 * 60;
}

function parseCookieHeader(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

export function readRefreshFromRequest(req: Request): string | undefined {
  const cookies = parseCookieHeader(req.headers.cookie);
  const fromCookie = cookies[REFRESH_COOKIE_NAME()];
  if (fromCookie?.trim()) return fromCookie.trim();
  return undefined;
}

function buildSetCookie(name: string, value: string, maxAge: number, clear = false): string {
  const parts = [
    `${name}=${clear ? '' : encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${clear ? 0 : maxAge}`,
  ];
  if (clear) parts.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  const sameSite = refreshCookieSameSite();
  parts.push(`SameSite=${sameSite.charAt(0).toUpperCase()}${sameSite.slice(1)}`);
  if (refreshCookieSecure() || sameSite === 'none') parts.push('Secure');
  const domain = (process.env.REFRESH_COOKIE_DOMAIN || '').trim();
  if (domain) parts.push(`Domain=${domain}`);
  return parts.join('; ');
}

export function setRefreshCookie(res: Response, refreshToken: string) {
  if (!refreshCookieEnabled()) return;
  const prev = res.getHeader('Set-Cookie');
  const next = buildSetCookie(REFRESH_COOKIE_NAME(), refreshToken, refreshCookieMaxAgeSec());
  if (!prev) {
    res.setHeader('Set-Cookie', next);
  } else if (Array.isArray(prev)) {
    res.setHeader('Set-Cookie', [...prev.map(String), next]);
  } else {
    res.setHeader('Set-Cookie', [String(prev), next]);
  }
}

export function clearRefreshCookie(res: Response) {
  if (!refreshCookieEnabled()) return;
  const prev = res.getHeader('Set-Cookie');
  const next = buildSetCookie(REFRESH_COOKIE_NAME(), '', 0, true);
  if (!prev) {
    res.setHeader('Set-Cookie', next);
  } else if (Array.isArray(prev)) {
    res.setHeader('Set-Cookie', [...prev.map(String), next]);
  } else {
    res.setHeader('Set-Cookie', [String(prev), next]);
  }
}

/**
 * Extrai refresh: cookie HttpOnly tem precedência (Phase 9).
 * Body permanece fallback para localhost / legado / clientes sem cookie.
 */
export function resolveRefreshToken(req: Request, bodyToken?: string): string | undefined {
  const fromCookie = readRefreshFromRequest(req);
  if (fromCookie) return fromCookie;
  const fromBody = typeof bodyToken === 'string' ? bodyToken.trim() : '';
  if (fromBody) return fromBody;
  return undefined;
}
