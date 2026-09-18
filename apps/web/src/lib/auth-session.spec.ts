import assert from 'assert';
import {
  AUTH_STORAGE_KEYS,
  discardStaleRefreshStorage,
  isCookieFirstHost,
  persistAuthSession,
  refreshBodyForRequest,
  refreshBodyFromStorage,
  shouldPersistRefreshInLocalStorage,
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
// Localhost dual-mode: body still sent when storage has a token.
assert.deepEqual(refreshBodyForRequest('localhost', 'rt-local'), { refreshToken: 'rt-local' });
assert.deepEqual(refreshBodyForRequest('127.0.0.1', '  rt-local  '), { refreshToken: 'rt-local' });
assert.deepEqual(refreshBodyForRequest('localhost', null), {});
assert.deepEqual(refreshBodyForRequest('localhost', ''), {});

const user = { id: 'u1', email: 'a@b.c', role: 'customer', name: 'A' };

// Cookie-first (prod / Android WebView): never persist body refresh even when JSON has it.
const prod = mem({ [AUTH_STORAGE_KEYS.refresh]: 'legacy-rt' });
persistAuthSession(prod, 'lojasschimitz.com.br', {
  accessToken: 'acc-1',
  refreshToken: 'rt-should-not-stick',
  user,
});
assert.equal(prod.getItem(AUTH_STORAGE_KEYS.access), 'acc-1');
assert.equal(prod.getItem(AUTH_STORAGE_KEYS.refresh), null);
assert.ok(prod.getItem(AUTH_STORAGE_KEYS.user)?.includes('a@b.c'));

// Localhost dual-mode: persist body refresh when API still returns it (default).
const local = mem();
persistAuthSession(local, 'localhost', {
  accessToken: 'acc-2',
  refreshToken: 'rt-local',
  user,
});
assert.equal(local.getItem(AUTH_STORAGE_KEYS.refresh), 'rt-local');

// REFRESH_JSON_TOKEN_ENABLED=false: payload omits refreshToken.
// Prod still cookie-first (empty body on refresh/logout).
const jsonOmitProd = mem({ [AUTH_STORAGE_KEYS.refresh]: 'stale' });
persistAuthSession(jsonOmitProd, 'lojasschimitz.com.br', {
  accessToken: 'acc-3',
  user,
});
assert.equal(jsonOmitProd.getItem(AUTH_STORAGE_KEYS.access), 'acc-3');
assert.equal(jsonOmitProd.getItem(AUTH_STORAGE_KEYS.refresh), null);
assert.deepEqual(refreshBodyFromStorage(jsonOmitProd.getItem(AUTH_STORAGE_KEYS.refresh)), {});

// Localhost + omitted JSON token: do not wipe a pre-existing body refresh (legacy fallback).
const jsonOmitLocal = mem({ [AUTH_STORAGE_KEYS.refresh]: 'keep-legacy' });
persistAuthSession(jsonOmitLocal, '127.0.0.1', { accessToken: 'acc-4', user });
assert.equal(jsonOmitLocal.getItem(AUTH_STORAGE_KEYS.refresh), 'keep-legacy');

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

// discardStaleRefreshStorage only drops on cookie-first hosts.
const staleProd = mem({ [AUTH_STORAGE_KEYS.refresh]: 'legacy-keep-or-not' });
discardStaleRefreshStorage(staleProd, 'lojasschimitz.com.br');
assert.equal(staleProd.getItem(AUTH_STORAGE_KEYS.refresh), null);
const staleLocal = mem({ [AUTH_STORAGE_KEYS.refresh]: 'keep-on-local' });
discardStaleRefreshStorage(staleLocal, 'localhost');
assert.equal(staleLocal.getItem(AUTH_STORAGE_KEYS.refresh), 'keep-on-local');

// Cookie-only login → persist → refresh → logout (prod / Android WebView).
const cookieOnlyFlow = mem({ [AUTH_STORAGE_KEYS.refresh]: 'pre-flip-stale' });
persistAuthSession(cookieOnlyFlow, 'lojasschimitz.com.br', {
  accessToken: 'acc-login',
  user,
});
assert.equal(cookieOnlyFlow.getItem(AUTH_STORAGE_KEYS.access), 'acc-login');
assert.equal(cookieOnlyFlow.getItem(AUTH_STORAGE_KEYS.refresh), null);
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
assert.equal(cookieOnlyFlow.getItem(AUTH_STORAGE_KEYS.access), 'acc-refreshed');
assert.equal(cookieOnlyFlow.getItem(AUTH_STORAGE_KEYS.refresh), null);
const afterLogout = wipeAuthSessionStorage(cookieOnlyFlow);
assert.deepEqual(refreshBodyForRequest('lojasschimitz.com.br', afterLogout.refreshToken), {});
assert.equal(cookieOnlyFlow.getItem(AUTH_STORAGE_KEYS.access), null);
assert.equal(cookieOnlyFlow.getItem(AUTH_STORAGE_KEYS.user), null);

console.log('auth-session unit tests ok');
