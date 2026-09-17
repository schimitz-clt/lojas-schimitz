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
 *
 * Phase A: JSON `refreshToken` remains the API default (`REFRESH_JSON_TOKEN_ENABLED`
 * unset/true). Cookie-first hosts ignore a body token even when present, and still
 * work when the API omits it (deprecation path — do not flip in prod).
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

/**
 * Body for /auth/refresh and /auth/logout.
 * Empty object → cookie-only; non-empty → dual-mode body (+ cookie still sent).
 */
export function refreshBodyFromStorage(stored: string | null | undefined): { refreshToken?: string } {
  const t = typeof stored === 'string' ? stored.trim() : '';
  return t ? { refreshToken: t } : {};
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
  } else if (!shouldPersistRefreshInLocalStorage(hostname)) {
    storage.removeItem(AUTH_STORAGE_KEYS.refresh);
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
