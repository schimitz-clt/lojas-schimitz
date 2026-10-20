import assert from 'node:assert/strict';
import { fetchUpstreamWithRetry, UPSTREAM_RETRY_BUDGET_MS } from './api-proxy-upstream';

// Relógio falso: sleep e "pendurar" avançam o tempo, nada espera de verdade.
let clock = 0;
const now = () => clock;
const sleep = async (ms: number) => { clock += ms; };
const res = (status: number) => new Response(status === 200 ? 'ok' : 'Application failed to respond', { status });
type Step = number | 'err' | { hangMs: number };
function fake(seq: Step[]) {
  const calls: Array<RequestInit | undefined> = [];
  const f = (async (_u: string, init?: RequestInit) => {
    const s = seq[Math.min(calls.length, seq.length - 1)];
    calls.push(init);
    if (s === 'err') throw new TypeError('fetch failed');
    if (typeof s === 'object') {
      // upstream pendurado: só termina quando o sinal da tentativa estoura.
      const limit = init?.signal ? (init.signal as AbortSignal & { _ms?: number }) : null;
      clock += s.hangMs;
      if (limit) throw new DOMException('timeout', 'TimeoutError');
      return res(502);
    }
    return res(s);
  }) as unknown as typeof fetch;
  return { f, calls };
}
const run = (seq: Step[], method = 'GET') => { const t = fake(seq); return { t, p: fetchUpstreamWithRetry('u', {}, method, { fetch: t.f, sleep, now }) }; };

(async () => {
  // deploy da API: 502, 502, erro de rede, depois 200 → loja recebe 200.
  clock = 0; let { t, p } = run([502, 502, 'err', 200]);
  assert.equal((await p).status, 200); assert.equal(t.calls.length, 4);
  // 1ª tentativa sem timeout (GET lento legítimo intacto); repetições com sinal de orçamento.
  assert.equal(t.calls[0]?.signal, undefined); assert.ok(t.calls[1]?.signal);
  // nunca repete métodos que alteram estado (pedido / pagamento).
  for (const m of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    ({ t, p } = run([502, 200], m)); assert.equal((await p).status, 502); assert.equal(t.calls.length, 1);
    ({ t, p } = run(['err', 200], m)); await assert.rejects(p); assert.equal(t.calls.length, 1);
  }
  // respostas da API (4xx/500/503) passam direto.
  for (const s of [200, 401, 404, 429, 500, 503]) { ({ t, p } = run([s, 200])); assert.equal((await p).status, s); assert.equal(t.calls.length, 1); }
  // sempre 502: para dentro do orçamento e devolve 502.
  clock = 0; ({ t, p } = run([502])); assert.equal((await p).status, 502);
  assert.ok(clock <= UPSTREAM_RETRY_BUDGET_MS, `repetição limitada a ${UPSTREAM_RETRY_BUDGET_MS} ms (gastou ${clock})`);
  // regressão de produção: 1ª tentativa 502 lento (15 s), repetições penduradas → resposta em ≤ 15 s + orçamento, nunca 30 s+.
  clock = 0; ({ t, p } = run([{ hangMs: 15000 }, { hangMs: 60000 }]));
  const r = await p; assert.equal(r.status, 502);
  console.log('api-proxy-retry.spec OK');
})().catch((e) => { console.error(e); process.exit(1); });
