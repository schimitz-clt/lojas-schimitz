import assert from 'assert';
import {
  AUTH_STORAGE_KEYS,
  discardStaleAuthTokenStorage,
  discardStaleRefreshStorage,
  isCookieFirstHost,
  persistAuthSession,
  refreshBodyForRequest,
  refreshBodyFromStorage,
  SESSION_UPDATED_EVENT,
  shouldPersistRefreshInLocalStorage,
  shouldRestoreSessionFromCookies,
  wipeAuthSessionStorage,
} from './auth-session';

function mem(initial: Record<string, string> = {}) {
  const m = new Map<string, string>(Object.entries(initial));
  return {
    getItem(key: string) {
      return m.has(key) ? m.get(key)! : null;
    },
    setItem(key: string, value: string) {
      m.set(key, value);
    },
    removeItem(key: string) {
      m.delete(key);
    },
  };
}

assert.equal(shouldPersistRefreshInLocalStorage('localhost'), true);
assert.equal(shouldPersistRefreshInLocalStorage('127.0.0.1'), true);
assert.equal(shouldPersistRefreshInLocalStorage('LOCALHOST'), true);
assert.equal(shouldPersistRefreshInLocalStorage('lojasschimitz.com.br'), false);
assert.equal(shouldPersistRefreshInLocalStorage('www.lojasschimitz.com.br'), false);
assert.equal(shouldPersistRefreshInLocalStorage(''), false);
assert.equal(isCookieFirstHost('lojasschimitz.com.br'), true);
assert.equal(isCookieFirstHost('www.lojasschimitz.com.br'), true);
assert.equal(isCookieFirstHost('localhost'), false);
assert.equal(isCookieFirstHost('127.0.0.1'), false);

assert.equal(SESSION_UPDATED_EVENT, 'sch-session-updated');
assert.equal(shouldRestoreSessionFromCookies('lojasschimitz.com.br', false), true);
assert.equal(shouldRestoreSessionFromCookies('www.lojasschimitz.com.br', false), true);
assert.equal(shouldRestoreSessionFromCookies('lojasschimitz.com.br', true), false);
assert.equal(shouldRestoreSessionFromCookies('localhost', false), false);
assert.equal(shouldRestoreSessionFromCookies('127.0.0.1', false), false);

assert.deepEqual(refreshBodyFromStorage('rt-abc'), { refreshToken: 'rt-abc' });
assert.deepEqual(refreshBodyFromStorage('  rt-abc  '), { refreshToken: 'rt-abc' });
assert.deepEqual(refreshBodyFromStorage(null), {});
assert.deepEqual(refreshBodyFromStorage(undefined), {});
assert.deepEqual(refreshBodyFromStorage(''), {});
assert.deepEqual(refreshBodyFromStorage('   '), {});

// Cookie-first hosts never put refresh in the request body (stale localStorage ignored).
assert.deepEqual(refreshBodyForRequest('lojasschimitz.com.br', 'stale-rt'), {});
assert.deepEqual(refreshBodyForRequest('www.lojasschimitz.com.br', 'stale-rt'), {});
assert.deepEqual(refreshBodyForRequest('lojasschimitz.com.br', null), {});
assert.deepEqual(refreshBodyForRequest('lojasschimitz.com.br', ''), {});
// Localhost dual-mode: body still sent when *memory* has a token (not web storage).
assert.deepEqual(refreshBodyForRequest('localhost', 'rt-local'), { refreshToken: 'rt-local' });
assert.deepEqual(refreshBodyForRequest('127.0.0.1', '  rt-local  '), { refreshToken: 'rt-local' });
assert.deepEqual(refreshBodyForRequest('localhost', null), {});
assert.deepEqual(refreshBodyForRequest('localhost', ''), {});

const user = { id: 'u1', email: 'a@b.c', role: 'customer', name: 'A' };

// Cookie-first (prod / Android WebView): never persist JWTs even when JSON has them.
const prod = mem({
  [AUTH_STORAGE_KEYS.refresh]: 'legacy-rt',
  [AUTH_STORAGE_KEYS.access]: 'legacy-acc',
});
persistAuthSession(prod, 'lojasschimitz.com.br', {
  accessToken: 'acc-1',
  refreshToken: 'rt-should-not-stick',
  user,
});
assert.equal(prod.getItem(AUTH_STORAGE_KEYS.access), null);
assert.equal(prod.getItem(AUTH_STORAGE_KEYS.refresh), null);
assert.ok(prod.getItem(AUTH_STORAGE_KEYS.user)?.includes('a@b.c'));

// Localhost: still do not persist tokens in web storage (memory-only in api.ts).
const local = mem();
persistAuthSession(local, 'localhost', {
  accessToken: 'acc-2',
  refreshToken: 'rt-local',
  user,
});
assert.equal(local.getItem(AUTH_STORAGE_KEYS.access), null);
assert.equal(local.getItem(AUTH_STORAGE_KEYS.refresh), null);
assert.ok(local.getItem(AUTH_STORAGE_KEYS.user)?.includes('a@b.c'));

// REFRESH_JSON_TOKEN_ENABLED=false: payload omits refreshToken.
const jsonOmitProd = mem({ [AUTH_STORAGE_KEYS.refresh]: 'stale', [AUTH_STORAGE_KEYS.access]: 'stale-acc' });
persistAuthSession(jsonOmitProd, 'lojasschimitz.com.br', {
  accessToken: 'acc-3',
  user,
});
assert.equal(jsonOmitProd.getItem(AUTH_STORAGE_KEYS.access), null);
assert.equal(jsonOmitProd.getItem(AUTH_STORAGE_KEYS.refresh), null);
assert.deepEqual(refreshBodyFromStorage(jsonOmitProd.getItem(AUTH_STORAGE_KEYS.refresh)), {});

// Localhost + omitted JSON token: leftover storage tokens are still wiped.
const jsonOmitLocal = mem({ [AUTH_STORAGE_KEYS.refresh]: 'keep-legacy' });
persistAuthSession(jsonOmitLocal, '127.0.0.1', { accessToken: 'acc-4', user });
assert.equal(jsonOmitLocal.getItem(AUTH_STORAGE_KEYS.refresh), null);
assert.equal(jsonOmitLocal.getItem(AUTH_STORAGE_KEYS.access), null);

// Logout: wipe local keys and expose prior tokens for /auth/logout (cookie + optional body).
const toClear = mem({
  [AUTH_STORAGE_KEYS.access]: 'acc-out',
  [AUTH_STORAGE_KEYS.refresh]: 'rt-out',
  [AUTH_STORAGE_KEYS.user]: JSON.stringify(user),
});
const wiped = wipeAuthSessionStorage(toClear);
assert.deepEqual(wiped, { access: 'acc-out', refreshToken: 'rt-out' });
assert.equal(toClear.getItem(AUTH_STORAGE_KEYS.access), null);
assert.equal(toClear.getItem(AUTH_STORAGE_KEYS.refresh), null);
assert.equal(toClear.getItem(AUTH_STORAGE_KEYS.user), null);
assert.deepEqual(refreshBodyFromStorage(wiped.refreshToken), { refreshToken: 'rt-out' });

const emptyWipe = wipeAuthSessionStorage(mem());
assert.deepEqual(emptyWipe, { access: '', refreshToken: '' });
assert.deepEqual(refreshBodyFromStorage(emptyWipe.refreshToken), {});

// Prod logout/refresh: even if wipe returned a leftover token, request body stays empty.
assert.deepEqual(refreshBodyForRequest('lojasschimitz.com.br', wiped.refreshToken), {});
assert.deepEqual(refreshBodyForRequest('localhost', wiped.refreshToken), { refreshToken: 'rt-out' });

// discardStale* drops token keys on every host (including localhost).
const staleProd = mem({ [AUTH_STORAGE_KEYS.refresh]: 'legacy-keep-or-not', [AUTH_STORAGE_KEYS.access]: 'acc' });
discardStaleRefreshStorage(staleProd, 'lojasschimitz.com.br');
assert.equal(staleProd.getItem(AUTH_STORAGE_KEYS.refresh), null);
assert.equal(staleProd.getItem(AUTH_STORAGE_KEYS.access), null);
const staleLocal = mem({ [AUTH_STORAGE_KEYS.refresh]: 'keep-on-local', [AUTH_STORAGE_KEYS.access]: 'acc-local' });
discardStaleAuthTokenStorage(staleLocal);
assert.equal(staleLocal.getItem(AUTH_STORAGE_KEYS.refresh), null);
assert.equal(staleLocal.getItem(AUTH_STORAGE_KEYS.access), null);

// Cookie-only login → persist → refresh → logout (prod / Android WebView).
const cookieOnlyFlow = mem({
  [AUTH_STORAGE_KEYS.refresh]: 'pre-flip-stale',
  [AUTH_STORAGE_KEYS.access]: 'pre-flip-access',
});
persistAuthSession(cookieOnlyFlow, 'lojasschimitz.com.br', {
  accessToken: 'acc-login',
  user,
});
assert.equal(cookieOnlyFlow.getItem(AUTH_STORAGE_KEYS.access), null);
assert.equal(cookieOnlyFlow.getItem(AUTH_STORAGE_KEYS.refresh), null);
assert.ok(cookieOnlyFlow.getItem(AUTH_STORAGE_KEYS.user)?.includes('a@b.c'));
assert.deepEqual(
  refreshBodyForRequest(
    'lojasschimitz.com.br',
    cookieOnlyFlow.getItem(AUTH_STORAGE_KEYS.refresh),
  ),
  {},
);
persistAuthSession(cookieOnlyFlow, 'lojasschimitz.com.br', {
  accessToken: 'acc-refreshed',
  user,
});
assert.equal(cookieOnlyFlow.getItem(AUTH_STORAGE_KEYS.access), null);
assert.equal(cookieOnlyFlow.getItem(AUTH_STORAGE_KEYS.refresh), null);
const afterLogout = wipeAuthSessionStorage(cookieOnlyFlow);
assert.deepEqual(refreshBodyForRequest('lojasschimitz.com.br', afterLogout.refreshToken), {});
assert.equal(cookieOnlyFlow.getItem(AUTH_STORAGE_KEYS.access), null);
assert.equal(cookieOnlyFlow.getItem(AUTH_STORAGE_KEYS.user), null);

// Source lock: never persist JWTs; logout wipes storage and POSTs /auth/logout with credentials.
const authSrc = require('fs').readFileSync(require('path').join(__dirname, 'auth-session.ts'), 'utf8');
assert.ok(
  !/storage\.setItem\(\s*AUTH_STORAGE_KEYS\.(access|refresh)/.test(authSrc),
  'persistAuthSession must not write access/refresh to web storage',
);
assert.ok(authSrc.includes('discardStaleAuthTokenStorage'), 'leftover JWT keys are scrubbed');

const apiSrc = require('fs').readFileSync(require('path').join(__dirname, 'api.ts'), 'utf8');
assert.ok(apiSrc.includes('wipeAuthSessionStorage'), 'clearSession wipes local keys');
assert.ok(apiSrc.includes('/auth/logout'), 'clearSession calls logout endpoint');
assert.ok(apiSrc.includes("credentials: 'include'"), 'logout fetch sends session cookies');
assert.ok(apiSrc.includes('refreshBodyForRequest'), 'cookie-first hosts send empty body');
assert.ok(!apiSrc.includes("localStorage.setItem('sch_access'"), 'must not persist access JWT');
assert.ok(!apiSrc.includes("localStorage.setItem('sch_refresh'"), 'must not persist refresh JWT');
assert.ok(!apiSrc.includes("sessionStorage.setItem('sch_access'"), 'must not persist access in sessionStorage');
assert.ok(!apiSrc.includes("sessionStorage.setItem('sch_refresh'"), 'must not persist refresh in sessionStorage');
assert.ok(!apiSrc.includes("localStorage.getItem('sch_access'"), 'must not read access JWT from localStorage');
assert.ok(apiSrc.includes('isCookieFirstHost'), 'cookie-first skips Bearer from JS');
assert.ok(!apiSrc.includes('REFRESH_JSON_TOKEN_ENABLED'), 'client must not flip JSON refresh flag');
assert.ok(apiSrc.includes('ensureHydratedSession'), 'cold start restores cookie session');
assert.ok(apiSrc.includes("'/auth/refresh'"), 'hydrate uses refresh, not localStorage JWT');
assert.ok(apiSrc.includes('shouldRestoreSessionFromCookies'), 'hydrate skips when sch_user already present');
assert.ok(apiSrc.includes('SESSION_UPDATED_EVENT'), 'login/logout/hydrate notify chrome');

console.log('auth-session unit tests ok');
