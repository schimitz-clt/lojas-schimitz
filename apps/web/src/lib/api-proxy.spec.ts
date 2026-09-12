import assert from 'assert';
import {
  buildUpstreamUrl,
  getBrowserApiBase,
  normalizeProxyOrigin,
  resolveApiProxyTarget,
  rewriteSetCookieForSameOrigin,
} from './api-proxy';

const saved = { ...process.env };

function restore() {
  for (const k of Object.keys(process.env)) {
    if (!(k in saved)) delete process.env[k];
  }
  Object.assign(process.env, saved);
}

try {
  assert.equal(normalizeProxyOrigin('https://api.example/api/v1'), 'https://api.example');
  assert.equal(normalizeProxyOrigin('https://api.example/api/v1/'), 'https://api.example');
  assert.equal(normalizeProxyOrigin('https://api.example'), 'https://api.example');

  delete process.env.API_PROXY_TARGET;
  process.env.NEXT_PUBLIC_API_URL = 'https://lojas-schimitz-production.up.railway.app/api/v1';
  assert.equal(resolveApiProxyTarget(), 'https://lojas-schimitz-production.up.railway.app');

  process.env.API_PROXY_TARGET = 'https://lojas-schimitz-production.up.railway.app/api/v1';
  assert.equal(resolveApiProxyTarget(), 'https://lojas-schimitz-production.up.railway.app');

  delete process.env.API_PROXY_TARGET;
  process.env.NEXT_PUBLIC_API_URL = 'https://lojas-schimitz-production.up.railway.app/api/v1';
  assert.equal(
    buildUpstreamUrl(['health'], ''),
    'https://lojas-schimitz-production.up.railway.app/api/v1/health',
  );
  assert.equal(
    buildUpstreamUrl(['products'], '?page=1'),
    'https://lojas-schimitz-production.up.railway.app/api/v1/products?page=1',
  );
  assert.equal(
    buildUpstreamUrl(undefined, ''),
    'https://lojas-schimitz-production.up.railway.app/api/v1',
  );

  const rewritten = rewriteSetCookieForSameOrigin(
    'sch_refresh=abc%2F; Path=/; HttpOnly; Max-Age=100; SameSite=None; Secure; Domain=.lojasschimitz.com.br',
  );
  assert.ok(rewritten.includes('sch_refresh='), rewritten);
  assert.ok(rewritten.includes('SameSite=Lax'), rewritten);
  assert.ok(rewritten.includes('Secure'), rewritten);
  assert.ok(!/domain=/i.test(rewritten), rewritten);

  // getBrowserApiBase without window → env
  assert.equal(
    getBrowserApiBase(),
    'https://lojas-schimitz-production.up.railway.app/api/v1',
  );

  console.log('api-proxy unit tests ok');
} finally {
  restore();
}
