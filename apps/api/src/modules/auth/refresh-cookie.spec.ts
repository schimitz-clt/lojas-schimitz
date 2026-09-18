import assert from 'assert';
import type { Request, Response } from 'express';
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  accessCookieMaxAgeSec,
  clearAuthCookies,
  clearRefreshCookie,
  issueAuthSession,
  readAccessFromRequest,
  readRefreshFromRequest,
  refreshCookieEnabled,
  refreshCookieSameSite,
  refreshCookieSecure,
  refreshJsonTokenEnabled,
  resolveAccessToken,
  resolveRefreshToken,
  setRefreshCookie,
  shapeAuthSessionPayload,
  shouldOmitRefreshTokenInJson,
} from './refresh-cookie';
import { ok } from '../../common/http';

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
    'JWT_ACCESS_EXPIRES',
    'ACCESS_COOKIE_MAX_AGE_SEC',
    'ACCESS_COOKIE_NAME',
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
  delete process.env.ACCESS_COOKIE_NAME;
  assert.equal(ACCESS_COOKIE_NAME(), 'sch_access');

  delete process.env.ACCESS_COOKIE_MAX_AGE_SEC;
  delete process.env.JWT_ACCESS_EXPIRES;
  assert.equal(accessCookieMaxAgeSec(), 900);
  process.env.JWT_ACCESS_EXPIRES = '15m';
  assert.equal(accessCookieMaxAgeSec(), 900);
  process.env.JWT_ACCESS_EXPIRES = '1h';
  assert.equal(accessCookieMaxAgeSec(), 3600);
  process.env.ACCESS_COOKIE_MAX_AGE_SEC = '1200';
  assert.equal(accessCookieMaxAgeSec(), 1200);
  delete process.env.ACCESS_COOKIE_MAX_AGE_SEC;
  delete process.env.JWT_ACCESS_EXPIRES;

  const req = {
    headers: { cookie: 'sch_refresh=abc%2Fdef; other=1' },
  } as unknown as Request;
  assert.equal(readRefreshFromRequest(req), 'abc/def');

  const reqAccess = {
    headers: {
      authorization: 'Bearer hdr-acc',
      cookie: 'sch_access=cookie-acc; sch_refresh=rt',
    },
  } as unknown as Request;
  assert.equal(readAccessFromRequest(reqAccess), 'cookie-acc');
  assert.equal(resolveAccessToken(reqAccess), 'hdr-acc', 'Bearer wins over access cookie');
  const reqCookieOnly = {
    headers: { cookie: 'sch_access=cookie-only' },
  } as unknown as Request;
  assert.equal(resolveAccessToken(reqCookieOnly), 'cookie-only');
  assert.equal(resolveAccessToken({ headers: {} } as unknown as Request), undefined);

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

  const dualRes = mockRes();
  process.env.REFRESH_COOKIE_SAMESITE = 'lax';
  delete process.env.REFRESH_COOKIE_SECURE;
  process.env.APP_ENV = 'development';
  const dualIssued = issueAuthSession(dualRes, {
    accessToken: 'a',
    refreshToken: 'r',
    user: { id: '1' },
  }) as any;
  assert.equal(dualIssued.refreshToken, 'r');
  const dualCookies = dualRes.getHeader('Set-Cookie');
  const dualCookieStr = Array.isArray(dualCookies) ? dualCookies.join('\n') : String(dualCookies);
  assert.ok(dualCookieStr.includes('sch_refresh='), dualCookieStr);
  assert.ok(dualCookieStr.includes('sch_access='), dualCookieStr);
  assert.ok(JSON.stringify(ok(dualIssued)).includes('refreshToken'));

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
  assert.equal('refreshToken' in omitted, false);
  assert.equal(omitted.accessToken, 'a');
  assert.equal(omitted.user.id, '1');
  const omittedJson = JSON.stringify(omitted);
  assert.ok(!omittedJson.includes('refreshToken'), omittedJson);
  assert.ok(!omittedJson.includes('"r"'), omittedJson);

  // HTTP envelope (controller: ok(issueAuthSession)) omits refreshToken, keeps access+user.
  const omitEnvelope = ok(
    shapeAuthSessionPayload({
      accessToken: 'acc-omit',
      refreshToken: 'rt-must-not-leak',
      user: { id: 'u1', email: 'a@b.c' },
    }),
  );
  assert.equal(omitEnvelope.ok, true);
  assert.equal((omitEnvelope.data as any).accessToken, 'acc-omit');
  assert.equal((omitEnvelope.data as any).refreshToken, undefined);
  assert.equal('refreshToken' in (omitEnvelope.data as any), false);
  const envelopeJson = JSON.stringify(omitEnvelope);
  assert.ok(!envelopeJson.includes('refreshToken'), envelopeJson);
  assert.ok(!envelopeJson.includes('rt-must-not-leak'), envelopeJson);

  // Cookie still preferred over body when JSON omit is active (dual-mode read).
  process.env.REFRESH_COOKIE_ENABLED = 'true';
  process.env.REFRESH_JSON_TOKEN_ENABLED = 'false';
  assert.equal(resolveRefreshToken(req, 'body-token'), 'abc/def');
  assert.equal(resolveRefreshToken(reqNoCookie, 'body-only'), 'body-only');

  // issueAuthSession: Set-Cookie + omit JSON (login/register/refresh cookie-only path).
  process.env.REFRESH_COOKIE_SAMESITE = 'lax';
  delete process.env.REFRESH_COOKIE_SECURE;
  process.env.APP_ENV = 'development';
  const issuedRes = mockRes();
  const issued = issueAuthSession(issuedRes, {
    accessToken: 'acc-login',
    refreshToken: 'rt-cookie-only',
    user: { id: '1', role: 'customer' },
  }) as any;
  const issuedCookieRaw = issuedRes.getHeader('Set-Cookie');
  const issuedCookie = Array.isArray(issuedCookieRaw) ? issuedCookieRaw.join('\n') : String(issuedCookieRaw);
  assert.ok(issuedCookie.includes('sch_refresh='), issuedCookie);
  assert.ok(issuedCookie.includes('sch_access='), issuedCookie);
  assert.ok(issuedCookie.includes('HttpOnly'), issuedCookie);
  assert.ok(issuedCookie.includes(encodeURIComponent('rt-cookie-only')) || issuedCookie.includes('rt-cookie-only'), issuedCookie);
  assert.ok(issuedCookie.includes('acc-login') || issuedCookie.includes(encodeURIComponent('acc-login')), issuedCookie);
  assert.equal(issued.refreshToken, undefined);
  assert.equal('refreshToken' in issued, false);
  assert.equal(issued.accessToken, 'acc-login');
  assert.equal(issued.user.id, '1');
  const issuedOk = ok(issued);
  assert.ok(!JSON.stringify(issuedOk).includes('refreshToken'));
  assert.ok(!JSON.stringify(issuedOk).includes('rt-cookie-only'));

  // Login → refresh (cookie only, empty body) → logout clear cookie.
  const afterLoginReq = {
    headers: { cookie: 'sch_refresh=rt-cookie-only' },
  } as unknown as Request;
  const resolvedFromCookieOnly = resolveRefreshToken(afterLoginReq, undefined);
  assert.equal(resolvedFromCookieOnly, 'rt-cookie-only');
  const resolvedCookieBeatsStaleBody = resolveRefreshToken(afterLoginReq, 'stale-localstorage');
  assert.equal(resolvedCookieBeatsStaleBody, 'rt-cookie-only');

  const refreshIssued = issueAuthSession(mockRes(), {
    accessToken: 'acc-2',
    refreshToken: 'rt-rotated',
    user: { id: '1' },
  }) as any;
  assert.equal('refreshToken' in refreshIssued, false);
  assert.equal(refreshIssued.accessToken, 'acc-2');

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

  // Logout must still clear HttpOnly cookies when JSON flag is false.
  clearAuthCookies(resJsonOff);
  const cleared = resJsonOff.getHeader('Set-Cookie');
  const clearedAll = Array.isArray(cleared) ? cleared.map(String) : [String(cleared)];
  assert.ok(clearedAll.some((c) => c.includes('sch_refresh=') && c.includes('Max-Age=0')), String(clearedAll));
  assert.ok(clearedAll.some((c) => c.includes('sch_access=') && c.includes('Max-Age=0')), String(clearedAll));
  assert.ok(clearedAll.every((c) => c.includes('HttpOnly')), String(clearedAll));
  assert.ok(clearedAll.some((c) => /Expires=Thu, 01 Jan 1970/i.test(c)), String(clearedAll));

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

  // Source locks: cookie precedes body; logout always clears cookie.
  const ctrl = require('fs').readFileSync(require('path').join(__dirname, 'auth.controller.ts'), 'utf8');
  assert.ok(ctrl.includes('resolveRefreshToken(req, dto?.refreshToken)'), 'refresh prefers cookie helper');
  assert.ok(ctrl.includes('resolveRefreshToken(req, body?.refreshToken)'), 'logout reads cookie then body');
  assert.ok(/async logout\([\s\S]*clearAuthCookies\(res\)/.test(ctrl), 'logout always clearAuthCookies');
  assert.ok(/async refresh\([\s\S]*clearAuthCookies\(res\)/.test(ctrl), 'refresh clears cookies when token missing');
  assert.ok(ctrl.includes("limit: 30"), 'logout is throttled');
  assert.ok(ctrl.includes('resolveAccessToken(req)'), 'logout reads access from Bearer or cookie');

  const jwtGuard = require('fs').readFileSync(
    require('path').join(__dirname, '../../common/guards/jwt-auth.guard.ts'),
    'utf8',
  );
  assert.ok(jwtGuard.includes('resolveAccessToken'), 'JwtAuthGuard accepts access cookie');

  console.log('refresh-cookie unit tests ok');
} finally {
  for (const k of Object.keys(process.env)) {
    if (!(k in saved)) delete process.env[k];
  }
  Object.assign(process.env, saved);
  resetEnv();
}
