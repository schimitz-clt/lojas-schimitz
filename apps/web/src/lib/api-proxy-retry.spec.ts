import assert from 'node:assert/strict';
import { fetchUpstreamWithRetry, UPSTREAM_RETRY_DELAYS_MS } from './api-proxy-upstream';

const res = (status: number) => new Response(status === 200 ? 'ok' : 'Application failed to respond', { status });
function fake(seq: Array<number | 'err'>) {
  const calls: number[] = [];
  const f = (async () => {
    const s = seq[Math.min(calls.length, seq.length - 1)];
    calls.push(calls.length);
    if (s === 'err') throw new TypeError('fetch failed');
    return res(s);
  }) as unknown as typeof fetch;
  return { f, calls };
}
const slept: number[] = [];
const sleep = async (ms: number) => { slept.push(ms); };

(async () => {
  // deploy da API: 502, 502, erro de rede, depois 200 → loja recebe 200.
  let t = fake([502, 502, 'err', 200]);
  let r = await fetchUpstreamWithRetry('u', {}, 'GET', { fetch: t.f, sleep });
  assert.equal(r.status, 200); assert.equal(t.calls.length, 4);
  // nunca repete métodos que alteram estado (pedido / pagamento).
  for (const m of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    t = fake([502, 200]);
    r = await fetchUpstreamWithRetry('u', {}, m, { fetch: t.f, sleep });
    assert.equal(r.status, 502, `${m} não repete`); assert.equal(t.calls.length, 1);
    t = fake(['err', 200]);
    await assert.rejects(fetchUpstreamWithRetry('u', {}, m, { fetch: t.f, sleep }));
    assert.equal(t.calls.length, 1);
  }
  // respostas da API (4xx/500/503) passam direto, sem repetir.
  for (const s of [200, 401, 404, 429, 500, 503]) {
    t = fake([s, 200]);
    r = await fetchUpstreamWithRetry('u', {}, 'GET', { fetch: t.f, sleep });
    assert.equal(r.status, s); assert.equal(t.calls.length, 1);
  }
  // orçamento limitado: depois de todas as esperas devolve o último 502.
  slept.length = 0; t = fake([502]);
  r = await fetchUpstreamWithRetry('u', {}, 'HEAD', { fetch: t.f, sleep });
  assert.equal(r.status, 502); assert.equal(t.calls.length, UPSTREAM_RETRY_DELAYS_MS.length + 1);
  assert.equal(slept.reduce((a, b) => a + b, 0), 11000);
  console.log('api-proxy-retry.spec OK');
})().catch((e) => { console.error(e); process.exit(1); });
