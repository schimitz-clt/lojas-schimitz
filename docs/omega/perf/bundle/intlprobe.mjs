// node intlprobe.mjs <origin> <route> — quem chama Intl/toLocale* no load (custo ICU ~40 ms a 4x na 1ª chamada)
import { chromium } from 'playwright-core';
const [origin, route] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--host-resolver-rules=MAP loja.test 127.0.0.1', '--ignore-certificate-errors'] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true }); const page = await ctx.newPage();
await page.addInitScript(() => {
  window.__intl = [];
  const rec = (k) => { const s = (new Error().stack || '').split('\n').slice(2, 4).map((x) => x.trim().replace(/https?:\/\/[^/]+/, '')).join(' < '); window.__intl.push([k, Math.round(performance.now()), s]); };
  for (const C of ['NumberFormat', 'DateTimeFormat', 'Collator', 'PluralRules', 'RelativeTimeFormat']) { const O = Intl[C]; Intl[C] = function (...a) { rec('Intl.' + C + ' ' + JSON.stringify(a).slice(0, 60)); return new O(...a); }; Intl[C].prototype = O.prototype; Intl[C].supportedLocalesOf = O.supportedLocalesOf; }
  for (const [P, m] of [[Number.prototype, 'toLocaleString'], [Date.prototype, 'toLocaleString'], [Date.prototype, 'toLocaleDateString'], [Date.prototype, 'toLocaleTimeString'], [String.prototype, 'localeCompare']]) { const o = P[m]; P[m] = function (...a) { rec(m + ' ' + JSON.stringify(a).slice(0, 60)); return o.apply(this, a); }; }
});
await page.goto(origin + route, { waitUntil: 'load' }); await page.waitForTimeout(3000);
const calls = await page.evaluate(() => window.__intl);
const agg = {}; for (const [k, , s] of calls) { const key = k + ' | ' + s; agg[key] = (agg[key] || 0) + 1; }
console.log(route, 'calls', calls.length, 'first at', calls[0]?.[1]);
for (const [k, v] of Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(String(v).padStart(4), k.slice(0, 220));
await browser.close();
