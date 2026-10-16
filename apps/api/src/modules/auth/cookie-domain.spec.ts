/**
 * Achado 7a: Domain do cookie de sessão depende do host (staging *.up.railway.app não recebe Domain alheio).
 * Produção (host dentro de REFRESH_COOKIE_DOMAIN) continua com o MESMO Set-Cookie.
 */
import assert from 'assert';
import type { Response } from 'express';
import { clearAuthCookies, cookieDomainForHost, issueAuthSession } from './refresh-cookie';

const ENV = { REFRESH_COOKIE_DOMAIN: '.lojasschimitz.com.br' };
assert.equal(cookieDomainForHost('lojasschimitz.com.br', ENV), '.lojasschimitz.com.br');
assert.equal(cookieDomainForHost('www.lojasschimitz.com.br', ENV), '.lojasschimitz.com.br');
assert.equal(cookieDomainForHost('api.lojasschimitz.com.br:443', ENV), '.lojasschimitz.com.br');
assert.equal(cookieDomainForHost('LOJASSCHIMITZ.COM.BR', ENV), '.lojasschimitz.com.br');
assert.equal(cookieDomainForHost('lojas-schimitz-staging.up.railway.app', ENV), '');
assert.equal(cookieDomainForHost('localhost:3001', ENV), '');
assert.equal(cookieDomainForHost('evil-lojasschimitz.com.br', ENV), '', 'sufixo sem ponto não conta');
assert.equal(cookieDomainForHost('lojasschimitz.com.br.evil.io', ENV), '');
assert.equal(cookieDomainForHost(undefined, ENV), '.lojasschimitz.com.br', 'sem host: comportamento antigo');
assert.equal(cookieDomainForHost('qualquer.app', {}), '', 'sem variável: nunca há Domain');

const saved = { ...process.env };
function res(host?: string) {
  const headers: Record<string, string | string[]> = {};
  return {
    headers,
    req: { headers: host ? { host } : {} },
    getHeader: (n: string) => headers[n.toLowerCase()],
    setHeader: (n: string, v: string | string[]) => { headers[n.toLowerCase()] = v; },
  } as unknown as Response & { headers: Record<string, string | string[]> };
}
try {
  process.env.REFRESH_COOKIE_DOMAIN = '.lojasschimitz.com.br';
  process.env.APP_ENV = 'production';
  const prod = res('lojasschimitz.com.br');
  issueAuthSession(prod, { accessToken: 'a', refreshToken: 'r' });
  const prodCookies = prod.headers['set-cookie'] as string[];
  assert.equal(prodCookies.length, 2);
  for (const c of prodCookies) assert.ok(c.includes('Domain=.lojasschimitz.com.br'), c);

  const stg = res('lojas-schimitz-api-staging.up.railway.app');
  issueAuthSession(stg, { accessToken: 'a', refreshToken: 'r' });
  clearAuthCookies(stg);
  const stgCookies = stg.headers['set-cookie'] as string[];
  assert.equal(stgCookies.length, 4);
  for (const c of stgCookies) assert.ok(!c.includes('Domain='), c);

  const fwd = res('internal:8080');
  (fwd as any).req.headers['x-forwarded-host'] = 'www.lojasschimitz.com.br';
  issueAuthSession(fwd, { accessToken: 'a', refreshToken: 'r' });
  for (const c of fwd.headers['set-cookie'] as string[]) assert.ok(c.includes('Domain=.lojasschimitz.com.br'), c);
} finally {
  process.env = saved;
}
console.log('cookie-domain (7a) ok');
