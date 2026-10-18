// Mesma comparação do spec, no ICU do Chrome (o que o usuário roda).
import { chromium } from 'playwright-core'; import fs from 'node:fs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const page = await browser.newPage(); await page.goto('data:text/html,x');
await page.addScriptTag({ content: fs.readFileSync('/tmp/mf.js', 'utf8') });
const r = await page.evaluate(() => {
  const { formatBrlCurrency, formatBrlCurrencyWhole, formatTwoDecimals, formatCount } = window.MF;
  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }), W = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }), T = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), I = new Intl.NumberFormat('pt-BR');
  let n = 0; const bad = [];
  const c = (v) => { n++; for (const [a, b] of [[formatBrlCurrency(v), BRL.format(v)], [formatBrlCurrencyWhole(v), W.format(v)], [formatTwoDecimals(v), T.format(v)], [formatCount(v), I.format(v)]]) if (a !== b && bad.length < 10) bad.push([v, a, b]); };
  for (const v of [0, -0, 0.005, 1.005, 2.675, 9.995, 999999.995, 1e-7, -1e-7, 1e15, NaN, Infinity]) c(v);
  for (let ct = 0; ct <= 300000; ct += 7) { const p = ct / 100; for (const v of [p, p * 0.95, p * 0.9, p / 3, p / 12, -p]) c(v); }
  let s = 7; const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let i = 0; i < 200000; i++) c((rnd() - 0.1) * 10 ** Math.floor(rnd() * 16 - 3));
  return { checked: n, bad };
});
console.log(JSON.stringify(r)); await browser.close();
