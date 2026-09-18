/**
 * Cookie-first refresh helpers (web).
 *
 * Production / same-origin (`/api/v1` on lojasschimitz.com.br, incl. Android WebView):
 * prefer HttpOnly `sch_refresh` cookie — do not persist refresh in localStorage,
 * and do not send a leftover `sch_refresh` in the request body (cookie is the source).
 *
 * Localhost: browser talks to API on :3001 (cross-origin), so cookie may not attach;
 * keep refreshToken in localStorage and send it in the request body.
 *
 * Missing JSON `refreshToken` (API `REFRESH_JSON_TOKEN_ENABLED=false`) is valid on
 * cookie-first hosts — Set-Cookie carries the session. Default API flag stays true
 * until Railway flip; this client is ready either way.
 *
 * apps/mobile is Kotlin WebView → same site URL (not Capacitor); cookie path applies.
 */

export const AUTH_STORAGE_KEYS = {
  access: 'sch_access',
  refresh: 'sch_refresh',
  user: 'sch_user',
} as const;

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
 * Localhost: dual-mode body if storage has a token.
 */
export function refreshBodyForRequest(
  hostname: string,
  stored: string | null | undefined,
): { refreshToken?: string } {
  if (isCookieFirstHost(hostname)) return {};
  return refreshBodyFromStorage(stored);
}

/** Drop leftover `sch_refresh` on cookie-first hosts (XSS surface + stale body). */
export function discardStaleRefreshStorage(storage: SessionStorageWriter, hostname: string): void {
  if (isCookieFirstHost(hostname)) {
    storage.removeItem(AUTH_STORAGE_KEYS.refresh);
  }
}

/**
 * Persist access+user. Refresh in localStorage only on localhost.
 * Production / Android WebView: always drop `sch_refresh` (cookie-first).
 * Missing `refreshToken` (REFRESH_JSON_TOKEN_ENABLED=false) is valid — cookie carries it.
 */
export function persistAuthSession(
  storage: SessionStorageWriter,
  hostname: string,
  data: AuthSessionPayload,
): void {
  storage.setItem(AUTH_STORAGE_KEYS.access, data.accessToken);
  storage.setItem(AUTH_STORAGE_KEYS.user, JSON.stringify(data.user));
  if (shouldPersistRefreshInLocalStorage(hostname) && data.refreshToken) {
    storage.setItem(AUTH_STORAGE_KEYS.refresh, data.refreshToken);
  } else {
    discardStaleRefreshStorage(storage, hostname);
  }
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
