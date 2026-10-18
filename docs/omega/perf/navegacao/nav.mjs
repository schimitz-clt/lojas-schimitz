// node nav.mjs <origin> <label>  — throttled mobile route-change timings (CPU 4x, ~4G)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const [origin, label] = process.argv.slice(2);
const out = `/workspace/ls-final-evidence/nav/${label}`; fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--host-resolver-rules=MAP loja.test 127.0.0.1', '--ignore-certificate-errors'] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A135M; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.0.0 Mobile Safari/537.36 LojasSchimitzApp/1.0.14' });
const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page);
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
await cdp.send('Network.enable');
await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8 * 8 / 8 * 1.0 * 1, uploadThroughput: 750 * 1024 / 8 });
await page.goto(origin + '/', { waitUntil: 'networkidle', timeout: 120000 });
await page.waitForTimeout(2500);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await page.evaluate(() => { window.__lt = []; new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push(e.duration))).observe({ type: 'longtask' }); window.__marker = 1; });
const steps = [];
async function step(name, act, readySel) {
  await page.evaluate(() => { window.__lt = []; });
  const t0 = Date.now();
  const u0 = page.url();
  await act();
  await page.waitForFunction((u) => location.href !== u, u0, { timeout: 30000 }).catch(() => {});
  const tUrl = Date.now() - t0;
  await page.waitForSelector(readySel, { timeout: 30000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector('.skel, [aria-busy="true"]'), null, { timeout: 30000 }).catch(() => {});
  const tReady = Date.now() - t0;
  const r = await page.evaluate(() => ({ softNav: window.__marker === 1, lt: (window.__lt || []).length, ltMs: Math.round((window.__lt || []).reduce((a, b) => a + b, 0)), url: location.pathname }));
  if (!r.softNav) await page.evaluate(() => { window.__marker = 1; window.__lt = []; new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push(e.duration))).observe({ type: 'longtask' }); });
  steps.push({ name, urlChangeMs: tUrl, readyMs: tReady, ...r });
  await page.waitForTimeout(2500);
}
await step('home→departamento (menu)', () => page.locator('a[href^="/departamento/"]:visible').first().click(), '.pcard, h1');
await step('departamento→produto (card)', () => page.locator('.pcard-link:visible').first().click(), '.pdp-buybox, h1');
await step('produto→carrinho (header)', () => page.locator('a[href="/carrinho"]:visible').first().click(), 'h1, .cart');
await step('carrinho→home (voltar x3)', async () => { await page.goBack(); }, 'h1');
await step('produto→departamento (voltar)', async () => { await page.goBack(); }, '.pcard');
await step('departamento→produtos (menu)', () => page.locator('a[href="/produtos"]:visible').first().click(), '.pcard');
const res = { origin, label, cpu: 4, network: '150ms RTT ~1.6Mbps', steps, jsErrors: errors };
fs.writeFileSync(`${out}/nav.json`, JSON.stringify(res, null, 2));
console.log(JSON.stringify(res, null, 1));
await browser.close();
