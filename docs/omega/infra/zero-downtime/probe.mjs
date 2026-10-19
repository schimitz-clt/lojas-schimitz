// Health alternates proxied/direct once per second (≤60/min/IP; API throttler = 100/min/IP).
// node probe.mjs <label> <seconds> — every 0.5 s: GET store "/" and "/api/v1/health" (both via lojasschimitz.com.br). Logs failures (non-2xx/3xx or network error/timeout 30 s (PROBE_TIMEOUT_MS)).
import fs from 'node:fs';
const [label, secs] = process.argv.slice(2);
const targets = { store: 'https://lojasschimitz.com.br/', health: 'https://lojasschimitz.com.br/api/v1/health', apiDirect: 'https://lojas-schimitz-production.up.railway.app/api/v1/health' };
const rows = []; const end = Date.now() + Number(secs) * 1000;
async function hit(name, url) {
  const t0 = Date.now(); let status = 0, err = '';
  try { const r = await fetch(url + (url.includes('?') ? '&' : '?') + 'probe=' + t0, { signal: AbortSignal.timeout(Number(process.env.PROBE_TIMEOUT_MS || 30000)), redirect: 'manual', headers: { 'cache-control': 'no-cache' } }); status = r.status; await r.arrayBuffer(); } catch (e) { err = String(e.cause?.code || e.name || e).slice(0, 40); }
  const ok = status >= 200 && status < 400;
  rows.push({ t: new Date(t0).toISOString(), name, status, ms: Date.now() - t0, ok, err });
  if (!ok) console.log(new Date(t0).toISOString(), name, status, err);
}
let k = 0;
while (Date.now() < end) { const tick = Date.now(); hit('store', targets.store); if (k % 2 === 0) hit((k / 2) % 2 === 0 ? 'health' : 'apiDirect', (k / 2) % 2 === 0 ? targets.health : targets.apiDirect); k++; await new Promise((r) => setTimeout(r, Math.max(0, 500 - (Date.now() - tick)))); }
await new Promise((r) => setTimeout(r, 31000));
const sum = {}; for (const r of rows) { sum[r.name] ??= { total: 0, failed: 0, slow2s: 0 }; sum[r.name].total++; if (!r.ok) sum[r.name].failed++; if (r.ms > 2000) sum[r.name].slow2s++; }
fs.writeFileSync(`${label}.json`, JSON.stringify({ label, sum, rows }, null, 1));
console.log(label, JSON.stringify(sum));
