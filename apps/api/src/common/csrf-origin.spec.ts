/**
 * CSRF por Origin: decisão pura + middleware real em servidor HTTP (sem banco).
 */
import assert from 'assert';
import http from 'http';
import express from 'express';
import { allowedOrigins, csrfOriginMiddleware, evaluateCsrfOrigin, resolveCsrfMode } from './csrf-origin';

const ENV: NodeJS.ProcessEnv = { CORS_ORIGINS: 'http://localhost:3000, https://lojasschimitz.com.br' } as any;
const COOKIE = 'sch_access=abc123';
const post = (h: Record<string, string>) => ({ method: 'POST', headers: { cookie: COOKIE, ...h } });

async function main() {
  // lista conhecida inclui variante www
  const set = allowedOrigins(ENV);
  assert.ok(set.has('https://lojasschimitz.com.br') && set.has('https://www.lojasschimitz.com.br'));

  // ATAQUE: site de terceiros + cookie → bloqueia
  const evil = evaluateCsrfOrigin(post({ origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' }), ENV);
  assert.equal(evil.allow, false);
  assert.equal(evaluateCsrfOrigin(post({ origin: 'null' }), ENV).allow, false);
  assert.equal(evaluateCsrfOrigin(post({ 'sec-fetch-site': 'cross-site' }), ENV).allow, false);
  assert.equal(evaluateCsrfOrigin(post({ referer: 'https://evil.example/x' }), ENV).allow, false);
  // domínio parecido não passa
  assert.equal(evaluateCsrfOrigin(post({ origin: 'https://lojasschimitz.com.br.evil.io' }), ENV).allow, false);

  // LEGÍTIMO: loja, www, same-origin, proxy por host, Bearer, sem cookie, GET, sem Origin
  assert.equal(evaluateCsrfOrigin(post({ origin: 'https://lojasschimitz.com.br' }), ENV).allow, true);
  assert.equal(evaluateCsrfOrigin(post({ origin: 'https://www.lojasschimitz.com.br' }), ENV).allow, true);
  assert.equal(evaluateCsrfOrigin(post({ origin: 'https://qualquer.app', 'sec-fetch-site': 'same-origin' }), ENV).allow, true);
  assert.equal(evaluateCsrfOrigin(post({ origin: 'https://novo.loja.com', 'x-forwarded-host': 'novo.loja.com' }), ENV).allow, true);
  assert.equal(evaluateCsrfOrigin(post({ origin: 'https://evil.example', authorization: 'Bearer tok' }), ENV).allow, true);
  assert.equal(evaluateCsrfOrigin({ method: 'POST', headers: { origin: 'https://evil.example' } }, ENV).allow, true, 'sem cookie de sessão não há o que "pegar carona"');
  assert.equal(evaluateCsrfOrigin({ method: 'GET', headers: { cookie: COOKIE, origin: 'https://evil.example' } }, ENV).allow, true);
  assert.equal(evaluateCsrfOrigin(post({}), ENV).allow, true);
  // webhook do Mercado Pago (sem cookie, sem Origin) nunca é afetado
  assert.equal(evaluateCsrfOrigin({ method: 'POST', headers: { 'x-signature': 'ts=1,v1=a' } }, ENV).allow, true);

  assert.equal(resolveCsrfMode({} as any), 'enforce');
  assert.equal(resolveCsrfMode({ CSRF_ORIGIN_CHECK: 'off' } as any), 'off');
  assert.equal(resolveCsrfMode({ CSRF_ORIGIN_CHECK: 'report' } as any), 'report');

  // --- servidor HTTP real
  process.env.CORS_ORIGINS = ENV.CORS_ORIGINS;
  delete process.env.CSRF_ORIGIN_CHECK;
  const app = express();
  app.use(csrfOriginMiddleware as any);
  let sideEffects = 0;
  app.post('/api/v1/admin/payments/:id/refund', (_req, res) => {
    sideEffects++;
    res.json({ ok: true });
  });
  const server = app.listen(0);
  const port = (server.address() as any).port;
  const call = (headers: Record<string, string>) =>
    new Promise<number>((resolve, reject) => {
      const r = http.request({ port, path: '/api/v1/admin/payments/x/refund', method: 'POST', headers }, (res) => {
        res.resume();
        res.on('end', () => resolve(res.statusCode || 0));
      });
      r.on('error', reject);
      r.end();
    });
  try {
    assert.equal(await call({ cookie: COOKIE, origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' }), 403);
    assert.equal(sideEffects, 0, 'o handler NÃO pode rodar quando bloqueado');
    assert.equal(await call({ cookie: COOKIE, origin: 'https://lojasschimitz.com.br', 'sec-fetch-site': 'same-origin' }), 200);
    assert.equal(sideEffects, 1);

    process.env.CSRF_ORIGIN_CHECK = 'report';
    assert.equal(await call({ cookie: COOKIE, origin: 'https://evil.example' }), 200, 'report não bloqueia');
    process.env.CSRF_ORIGIN_CHECK = 'off';
    assert.equal(await call({ cookie: COOKIE, origin: 'https://evil.example' }), 200, 'off = rollback');
  } finally {
    server.close();
  }
  console.log('csrf-origin unit + http tests ok');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
