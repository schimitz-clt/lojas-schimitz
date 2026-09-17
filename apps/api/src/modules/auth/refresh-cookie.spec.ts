import assert from 'assert';
import type { Request, Response } from 'express';
import {
  REFRESH_COOKIE_NAME,
  clearRefreshCookie,
  readRefreshFromRequest,
  refreshCookieEnabled,
  refreshCookieSameSite,
  refreshCookieSecure,
  refreshJsonTokenEnabled,
  resolveRefreshToken,
  setRefreshCookie,
  shapeAuthSessionPayload,
  shouldOmitRefreshTokenInJson,
} from './refresh-cookie';

const saved = { ...process.env };

function resetEnv() {
  for (const k of [
    'APP_ENV',
    'NODE_ENV',
    'REFRESH_COOKIE_ENABLED',
    'REFRESH_COOKIE_SECURE',
    'REFRESH_COOKIE_SAMESITE',
    'REFRESH_COOKIE_NAME',
    'REFRESH_COOKIE_DOMAIN',
    'REFRESH_JSON_TOKEN_ENABLED',
  ]) {
    if (k in saved) process.env[k] = saved[k]!;
    else delete process.env[k];
  }
}

function mockRes() {
  const headers: Record<string, string | string[]> = {};
  return {
    headers,
    getHeader(name: string) {
      return headers[name.toLowerCase()];
    },
    setHeader(name: string, value: string | string[]) {
      headers[name.toLowerCase()] = value;
    },
  } as unknown as Response & { headers: Record<string, string | string[]> };
}

try {
  delete process.env.REFRESH_COOKIE_ENABLED;
  assert.equal(refreshCookieEnabled(), true);

  process.env.REFRESH_COOKIE_ENABLED = 'false';
  assert.equal(refreshCookieEnabled(), false);

  process.env.REFRESH_COOKIE_ENABLED = 'true';
  process.env.APP_ENV = 'production';
  delete process.env.REFRESH_COOKIE_SECURE;
  delete process.env.REFRESH_COOKIE_SAMESITE;
  assert.equal(refreshCookieSecure(), true);
  assert.equal(refreshCookieSameSite(), 'none');

  process.env.APP_ENV = 'development';
  process.env.NODE_ENV = 'development';
  delete process.env.REFRESH_COOKIE_SECURE;
  delete process.env.REFRESH_COOKIE_SAMESITE;
  assert.equal(refreshCookieSecure(), false);
  assert.equal(refreshCookieSameSite(), 'lax');

  process.env.REFRESH_COOKIE_SAMESITE = 'strict';
  assert.equal(refreshCookieSameSite(), 'strict');

  delete process.env.REFRESH_COOKIE_NAME;
  assert.equal(REFRESH_COOKIE_NAME(), 'sch_refresh');
  process.env.REFRESH_COOKIE_NAME = 'my_rt';
  assert.equal(REFRESH_COOKIE_NAME(), 'my_rt');
  delete process.env.REFRESH_COOKIE_NAME;

  const req = {
    headers: { cookie: 'sch_refresh=abc%2Fdef; other=1' },
  } as unknown as Request;
  assert.equal(readRefreshFromRequest(req), 'abc/def');

  // Phase 9: cookie preferred over body
  assert.equal(resolveRefreshToken(req, 'body-token'), 'abc/def');
  assert.equal(resolveRefreshToken(req, '  '), 'abc/def');
  assert.equal(resolveRefreshToken(req, undefined), 'abc/def');

  const reqNoCookie = { headers: {} } as unknown as Request;
  assert.equal(resolveRefreshToken(reqNoCookie, 'body-only'), 'body-only');
  assert.equal(resolveRefreshToken(reqNoCookie, '  '), undefined);
  assert.equal(resolveRefreshToken(reqNoCookie, undefined), undefined);

  process.env.REFRESH_COOKIE_ENABLED = 'true';
  process.env.APP_ENV = 'development';
  process.env.REFRESH_COOKIE_SAMESITE = 'lax';
  delete process.env.REFRESH_COOKIE_SECURE;
  const res = mockRes();
  setRefreshCookie(res, 'rt-value-1');
  const set1 = String(res.getHeader('Set-Cookie'));
  assert.ok(set1.includes('sch_refresh='), set1);
  assert.ok(set1.includes('HttpOnly'), set1);
  assert.ok(set1.includes('SameSite=Lax'), set1);
  assert.ok(!set1.toLowerCase().includes('secure'), set1);

  clearRefreshCookie(res);
  const set2 = res.getHeader('Set-Cookie');
  const last = Array.isArray(set2) ? set2[set2.length - 1] : String(set2);
  assert.ok(String(last).includes('Max-Age=0'), String(last));

  process.env.REFRESH_COOKIE_ENABLED = 'false';
  const resOff = mockRes();
  setRefreshCookie(resOff, 'x');
  assert.equal(resOff.getHeader('Set-Cookie'), undefined);

  // JSON omit deprecation path (opt-in only). Default MUST stay true (Phase A: no prod flip).
  delete process.env.REFRESH_JSON_TOKEN_ENABLED;
  process.env.REFRESH_COOKIE_ENABLED = 'true';
  assert.equal(refreshJsonTokenEnabled(), true);
  assert.equal(shouldOmitRefreshTokenInJson(), false);
  const full = shapeAuthSessionPayload({
    accessToken: 'a',
    refreshToken: 'r',
    user: { id: '1' },
  });
  assert.equal((full as any).refreshToken, 'r');

  for (const keep of ['true', '1', 'on', 'TRUE', '']) {
    process.env.REFRESH_JSON_TOKEN_ENABLED = keep;
    assert.equal(refreshJsonTokenEnabled(), true, `json enabled for ${JSON.stringify(keep)}`);
    assert.equal(shouldOmitRefreshTokenInJson(), false, `must not omit for ${JSON.stringify(keep)}`);
  }

  for (const off of ['false', '0', 'off', 'FALSE']) {
    process.env.REFRESH_JSON_TOKEN_ENABLED = off;
    process.env.REFRESH_COOKIE_ENABLED = 'true';
    assert.equal(refreshJsonTokenEnabled(), false, `json disabled for ${off}`);
    assert.equal(shouldOmitRefreshTokenInJson(), true, `omit when cookie on + ${off}`);
  }

  process.env.REFRESH_JSON_TOKEN_ENABLED = 'false';
  assert.equal(refreshJsonTokenEnabled(), false);
  assert.equal(shouldOmitRefreshTokenInJson(), true);
  const omitted = shapeAuthSessionPayload({
    accessToken: 'a',
    refreshToken: 'r',
    user: { id: '1' },
  }) as any;
  assert.equal(omitted.refreshToken, undefined);
  assert.equal(omitted.accessToken, 'a');
  assert.equal(omitted.user.id, '1');

  // Cookie still preferred over body when JSON omit is active (dual-mode read).
  process.env.REFRESH_COOKIE_ENABLED = 'true';
  process.env.REFRESH_JSON_TOKEN_ENABLED = 'false';
  assert.equal(resolveRefreshToken(req, 'body-token'), 'abc/def');
  assert.equal(resolveRefreshToken(reqNoCookie, 'body-only'), 'body-only');

  // Set-Cookie still issued on login/refresh path when JSON omits refreshToken.
  process.env.REFRESH_COOKIE_SAMESITE = 'lax';
  delete process.env.REFRESH_COOKIE_SECURE;
  process.env.APP_ENV = 'development';
  const resJsonOff = mockRes();
  setRefreshCookie(resJsonOff, 'rt-cookie-only');
  const cookieOnly = String(resJsonOff.getHeader('Set-Cookie'));
  assert.ok(cookieOnly.includes('sch_refresh='), cookieOnly);
  assert.ok(cookieOnly.includes('HttpOnly'), cookieOnly);
  assert.ok(cookieOnly.includes('rt-cookie-only'), cookieOnly);

  // Logout must still clear HttpOnly cookie when JSON flag is false.
  clearRefreshCookie(resJsonOff);
  const cleared = resJsonOff.getHeader('Set-Cookie');
  const clearedLast = Array.isArray(cleared) ? cleared[cleared.length - 1] : String(cleared);
  assert.ok(String(clearedLast).includes('Max-Age=0'), String(clearedLast));
  assert.ok(String(clearedLast).includes('HttpOnly'), String(clearedLast));
  assert.ok(/Expires=Thu, 01 Jan 1970/i.test(String(clearedLast)), String(clearedLast));
  assert.ok(String(clearedLast).includes('sch_refresh='), String(clearedLast));

  // Cookie off → never omit (body-only clients), even if JSON flag is false.
  process.env.REFRESH_COOKIE_ENABLED = 'false';
  process.env.REFRESH_JSON_TOKEN_ENABLED = 'false';
  assert.equal(shouldOmitRefreshTokenInJson(), false);
  const stillBody = shapeAuthSessionPayload({
    accessToken: 'a',
    refreshToken: 'r',
    user: { id: '1' },
  }) as any;
  assert.equal(stillBody.refreshToken, 'r');

  console.log('refresh-cookie unit tests ok');
} finally {
  for (const k of Object.keys(process.env)) {
    if (!(k in saved)) delete process.env[k];
  }
  Object.assign(process.env, saved);
  resetEnv();
}
