// node pdptap.mjs <origin> <label> — tap product cards on /departamento/ofertas, time to PDP ready (CPU 4x, RTT 150ms)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const [origin, label] = process.argv.slice(2);
const out = `/workspace/ls-final-evidence/nav/${label}`; fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--host-resolver-rules=MAP loja.test 127.0.0.1', '--ignore-certificate-errors'] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true });
const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page);
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(origin + '/departamento/ofertas', { waitUntil: 'networkidle', timeout: 120000 });
await page.waitForTimeout(2000);
await cdp.send('Network.enable');
await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 0.75e6 / 8 });
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
const res = [];
for (let i = 0; i < 6; i++) {
  const card = page.locator('.pcard-link:visible').nth(i);
  await card.scrollIntoViewIfNeeded(); await page.waitForTimeout(1500);
  const box = await card.boundingBox(); const href = await card.getAttribute('href');
  const x = box.x + box.width / 2, y = box.y + Math.min(60, box.height / 2);
  const t0 = Date.now();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await new Promise((r) => setTimeout(r, 120));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForURL((u) => u.pathname === href, { timeout: 30000 });
  const tUrl = Date.now() - t0;
  await page.waitForSelector('.pdp-buybox', { timeout: 30000 });
  await page.waitForFunction(() => !document.querySelector('.pdp-skel, .skel'), null, { timeout: 30000 }).catch(() => {});
  res.push({ href, urlMs: tUrl, readyMs: Date.now() - t0 });
  await page.goBack(); await page.waitForSelector('.pcard-link'); await page.waitForTimeout(1500);
}
const ready = res.map((r) => r.readyMs).sort((a, b) => a - b);
const summary = { origin, label, cpu: 4, rttMs: 150, taps: res, medianReadyMs: ready[Math.floor(ready.length / 2)], jsErrors: errors };
fs.writeFileSync(`${out}/pdptap.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ label, ready: res.map((r) => r.readyMs), median: summary.medianReadyMs, errs: errors.length }));
await browser.close();
