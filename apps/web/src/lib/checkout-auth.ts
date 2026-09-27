import { loginNextPath } from './order-recovery';

/** Cart/checkout guest CTA — login or register, then return to checkout. */
export function checkoutAuthHref(): string {
  return loginNextPath('/checkout');
}

/** Open /entrar already on the cadastro form, preserving `next`. */
export function authRegisterHref(nextPath: string): string {
  const base = loginNextPath(nextPath);
  return `${base}${base.includes('?') ? '&' : '?'}cadastro=1`;
}

export function authPageModeFromSearch(search: string): 'login' | 'register' {
  const raw = String(search || '');
  const q = raw.startsWith('?') ? raw.slice(1) : raw;
  try {
    const params = new URLSearchParams(q);
    if (params.get('cadastro') === '1') return 'register';
  } catch {
    /* ignore */
  }
  return 'login';
}

export function cartCheckoutHref(loggedIn: boolean): string {
  return loggedIn ? '/checkout' : checkoutAuthHref();
}

/** HttpOnly session cookies set by the API through the same-origin /api/v1 proxy (Path=/). */
export const SESSION_COOKIE_NAMES = ['sch_refresh', 'sch_access'] as const;

/**
 * Server-side (middleware) guard for logged-out /checkout.
 * Returns the /entrar?next=… path to 307 to, or null to let the page render.
 * - Only exact /checkout (and trailing slash).
 * - Only on cookie-first hosts: localhost keeps sessions in memory (no cookie), so it
 *   must fall through to the client check or logged-in dev sessions would bounce.
 * - Any non-empty sch_refresh / sch_access cookie → render; an expired/revoked cookie
 *   is still handled by the client fallback in app/checkout/page.tsx.
 * - Keeps the query string inside `next`.
 */
export function checkoutServerRedirect(input: {
  pathname: string;
  search: string;
  hostname: string;
  cookieNames: readonly string[];
}): string | null {
  const path = input.pathname.replace(/\/+$/, '') || '/';
  if (path !== '/checkout') return null;
  const host = (input.hostname || '').toLowerCase().split(':')[0].trim();
  if (!host || host === 'localhost' || host === '127.0.0.1') return null;
  if (input.cookieNames.some((n) => (SESSION_COOKIE_NAMES as readonly string[]).includes(n))) return null;
  const search = input.search && input.search !== '?' ? input.search : '';
  return loginNextPath(`/checkout${search}`);
}
