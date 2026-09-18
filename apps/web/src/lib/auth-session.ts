/**
 * Cookie-first session helpers (web).
 *
 * Production / same-origin (`/api/v1` on lojasschimitz.com.br, incl. Android WebView):
 * HttpOnly `sch_refresh` + `sch_access` cookies — never persist JWTs in localStorage
 * or sessionStorage. Fetch uses credentials: 'include'.
 *
 * Localhost: browser talks to API on :3001 (cross-origin); cookies may not attach.
 * Keep access/refresh in **memory only** (api.ts) and send refresh in the request body.
 * Do not write tokens to web storage on localhost either (XSS + leftover prod cookies).
 *
 * Missing JSON `refreshToken` (API `REFRESH_JSON_TOKEN_ENABLED=false`) is valid on
 * cookie-first hosts — Set-Cookie carries the session. Default API flag stays true
 * until Railway flip; this client is ready either way. Do not re-enable the flag here.
 *
 * apps/mobile is Kotlin WebView → same site URL (not Capacitor); cookie path applies.
 */

export const AUTH_STORAGE_KEYS = {
  access: 'sch_access',
  refresh: 'sch_refresh',
  user: 'sch_user',
} as const;

/** Dispatched after login, logout, or cookie restore so chrome/Conta re-read `sch_user`. */
export const SESSION_UPDATED_EVENT = 'sch-session-updated';

/**
 * Cookie-first cold start: HttpOnly `sch_refresh` may exist while `sch_user` is missing
 * (WebView storage vs cookie stores). UI must restore via POST /auth/refresh before
 * treating the visitor as logged out.
 */
export function shouldRestoreSessionFromCookies(
  hostname: string,
  localUserPresent: boolean,
): boolean {
  if (localUserPresent) return false;
  return isCookieFirstHost(hostname);
}

export type AuthSessionPayload = {
  accessToken: string;
  refreshToken?: string;
  user: unknown;
};

type SessionStorageWriter = {
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

type SessionStorageReader = {
  getItem(key: string): string | null;
  removeItem(key: string): void;
};

/** True only on local dev hosts where API is typically cross-origin. */
export function shouldPersistRefreshInLocalStorage(hostname: string): boolean {
  const h = (hostname || '').toLowerCase().trim();
  return h === 'localhost' || h === '127.0.0.1';
}

/** Cookie-first: prod storefront, Admin on same host, Android WebView. */
export function isCookieFirstHost(hostname: string): boolean {
  return !shouldPersistRefreshInLocalStorage(hostname);
}

/**
 * Raw body helper: include stored token if present.
 * Prefer `refreshBodyForRequest` so cookie-first hosts never send stale storage.
 */
export function refreshBodyFromStorage(stored: string | null | undefined): { refreshToken?: string } {
  const t = typeof stored === 'string' ? stored.trim() : '';
  return t ? { refreshToken: t } : {};
}

/**
 * Body for /auth/refresh and /auth/logout.
 * Cookie-first hosts: always `{}` — HttpOnly cookie is sent via credentials.
 * Localhost: dual-mode body if memory (not web storage) has a token.
 */
export function refreshBodyForRequest(
  hostname: string,
  stored: string | null | undefined,
): { refreshToken?: string } {
  if (isCookieFirstHost(hostname)) return {};
  return refreshBodyFromStorage(stored);
}

/** Drop leftover `sch_access` / `sch_refresh` everywhere (XSS surface + stale body). */
export function discardStaleAuthTokenStorage(storage: SessionStorageWriter): void {
  storage.removeItem(AUTH_STORAGE_KEYS.access);
  storage.removeItem(AUTH_STORAGE_KEYS.refresh);
}

/** @deprecated use discardStaleAuthTokenStorage — hostname ignored; tokens never stay in web storage. */
export function discardStaleRefreshStorage(storage: SessionStorageWriter, _hostname?: string): void {
  discardStaleAuthTokenStorage(storage);
}

/**
 * Persist user profile only. Never write access/refresh JWTs to web storage.
 * Missing `refreshToken` (REFRESH_JSON_TOKEN_ENABLED=false) is valid — cookie carries it.
 */
export function persistAuthSession(
  storage: SessionStorageWriter,
  _hostname: string,
  data: AuthSessionPayload,
): void {
  discardStaleAuthTokenStorage(storage);
  storage.setItem(AUTH_STORAGE_KEYS.user, JSON.stringify(data.user));
}

/** Drop access/refresh/user keys. Returns prior tokens so logout can revoke cookie/body. */
export function wipeAuthSessionStorage(storage: SessionStorageReader): {
  access: string;
  refreshToken: string;
} {
  const refreshToken = storage.getItem(AUTH_STORAGE_KEYS.refresh) || '';
  const access = storage.getItem(AUTH_STORAGE_KEYS.access) || '';
  storage.removeItem(AUTH_STORAGE_KEYS.access);
  storage.removeItem(AUTH_STORAGE_KEYS.refresh);
  storage.removeItem(AUTH_STORAGE_KEYS.user);
  return { access, refreshToken };
}
