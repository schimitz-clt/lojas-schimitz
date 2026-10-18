// Todos os textos com "R$" / "resultados" da página, para comparar base × branch.
import { chromium } from 'playwright-core';
const [origin, route] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--host-resolver-rules=MAP loja.test 127.0.0.1', '--ignore-certificate-errors'] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true }); const page = await ctx.newPage();
const errs = []; page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 120)); }); page.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
await page.goto(origin + route, { waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
const t = await page.evaluate(() => { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); const out = []; let n; while ((n = w.nextNode())) { const s = n.textContent.trim(); if (/R\$|resultado|\d,\d\d/.test(s)) out.push(s); } return out; });
console.log(JSON.stringify({ n: t.length, hydrationErrors: errs.filter((e) => /hydrat|did not match|#418|#423|#425/i.test(e)), sample: t.slice(0, 4), all: t }));
await browser.close();
