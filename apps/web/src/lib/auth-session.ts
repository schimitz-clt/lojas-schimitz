/**
 * Cookie-first refresh helpers (web).
 *
 * Production / same-origin (`/api/v1` on lojasschimitz.com.br, incl. Android WebView):
 * prefer HttpOnly `sch_refresh` cookie — do not persist refresh in localStorage.
 *
 * Localhost: browser talks to API on :3001 (cross-origin), so cookie may not attach;
 * keep refreshToken in localStorage and send it in the request body.
 *
 * Dual-mode read: if localStorage still has a legacy/body refresh, send it;
 * otherwise rely on credentials: 'include' + cookie.
 *
 * apps/mobile is Kotlin WebView → same site URL (not Capacitor); cookie path applies.
 */

/** True only on local dev hosts where API is typically cross-origin. */
export function shouldPersistRefreshInLocalStorage(hostname: string): boolean {
  const h = (hostname || '').toLowerCase().trim();
  return h === 'localhost' || h === '127.0.0.1';
}

/**
 * Body for /auth/refresh and /auth/logout.
 * Empty object → cookie-only; non-empty → dual-mode body (+ cookie still sent).
 */
export function refreshBodyFromStorage(stored: string | null | undefined): { refreshToken?: string } {
  const t = typeof stored === 'string' ? stored.trim() : '';
  return t ? { refreshToken: t } : {};
}
