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
  // 7b: cookie de sessão SEM Origin e SEM Referer → bloqueia (antes: permitia)
  const noOrigin = evaluateCsrfOrigin({ method: 'POST', path: '/api/v1/admin/payments/x/refund', headers: { cookie: COOKIE } }, ENV);
  assert.deepEqual(noOrigin, { allow: false, reason: 'missing_origin' });
  assert.equal(evaluateCsrfOrigin({ method: 'PATCH', originalUrl: '/api/v1/users/me', headers: { cookie: COOKIE } }, ENV).allow, false);
  assert.equal(evaluateCsrfOrigin({ method: 'DELETE', originalUrl: '/api/v1/addresses/1', headers: { cookie: 'sch_refresh=r' } }, ENV).allow, false);
  // isentos: webhook MP (mesmo se vier cookie), token push do app Android (HttpURLConnection + cookie), relatórios CSP
  for (const path of ['/api/v1/webhooks/mercadopago', '/api/v1/webhooks/mercadopago?data.id=1', '/api/v1/push/tokens', '/api/v1/security/csp-report', '/api/v1/security/client-error']) {
    assert.equal(evaluateCsrfOrigin({ method: 'POST', originalUrl: path, headers: { cookie: COOKIE } }, ENV).allow, true, path);
  }
  // isenção não vale para Origin estranho
  assert.equal(evaluateCsrfOrigin({ method: 'POST', originalUrl: '/api/v1/push/tokens', headers: { cookie: COOKIE, origin: 'https://evil.example' } }, ENV).allow, false);
  // caminho parecido não é isento
  assert.equal(evaluateCsrfOrigin({ method: 'POST', originalUrl: '/api/v1/push/tokens/x/delete', headers: { cookie: COOKIE } }, ENV).allow, false);
  // WebView/navegador: fetch POST sempre manda Origin (ou Sec-Fetch-Site) → passa
  assert.equal(evaluateCsrfOrigin(post({ origin: 'https://lojasschimitz.com.br', 'sec-fetch-site': 'same-origin' }), ENV).allow, true);
  assert.equal(evaluateCsrfOrigin(post({ 'sec-fetch-site': 'same-origin' }), ENV).allow, true);
  assert.equal(evaluateCsrfOrigin(post({ referer: 'https://lojasschimitz.com.br/checkout' }), ENV).allow, true);
  // sem cookie (servidor-a-servidor, cron, curl) segue livre
  assert.equal(evaluateCsrfOrigin({ method: 'POST', path: '/api/v1/auth/login', headers: {} }, ENV).allow, true);
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

    // 7b no servidor real: cookie sem Origin/Referer → 403, handler não roda
    assert.equal(await call({ cookie: COOKIE }), 403);
    assert.equal(sideEffects, 1, 'sem Origin não executa o estorno');

    process.env.CSRF_ORIGIN_CHECK = 'report';
    assert.equal(await call({ cookie: COOKIE }), 200, 'report não bloqueia sem Origin');
    assert.equal(await call({ cookie: COOKIE, origin: 'https://evil.example' }), 200, 'report não bloqueia');
    process.env.CSRF_ORIGIN_CHECK = 'off';
    assert.equal(await call({ cookie: COOKIE, origin: 'https://evil.example' }), 200, 'off = rollback');
    assert.equal(await call({ cookie: COOKIE }), 200, 'off = rollback (sem Origin)');
  } finally {
    server.close();
  }
  console.log('csrf-origin unit + http tests ok');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
