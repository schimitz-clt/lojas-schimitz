// node hydrate.mjs <origin> <label> [runs]  — cold mobile load, CPU 4x, 150ms RTT ~1.6Mbps.
// Per route: JS bytes transferred, ScriptDuration/TaskDuration until load+3s, long tasks, time to first tap response (header button).
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const [origin, label, runsArg] = process.argv.slice(2); const runs = Number(runsArg || 5);
const out = `/workspace/ls-final-evidence/bundle/${label}`; fs.mkdirSync(out, { recursive: true });
const routes = ['/', '/produtos', '/produto/__PDP__', '/carrinho'];
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--host-resolver-rules=MAP loja.test 127.0.0.1', '--ignore-certificate-errors'] });
let pdp = null; const results = [];
for (let i = 0; i < runs; i++) for (const r0 of routes) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A135M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36' });
  const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page);
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  if (r0.includes('__PDP__') && !pdp) {
    await page.goto(origin + '/produtos', { waitUntil: 'networkidle', timeout: 120000 });
    pdp = await page.locator('.pcard-link').first().getAttribute('href');
  }
  const route = r0.replace('/produto/__PDP__', pdp || '/produtos');
  await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Performance.enable');
  let jsBytes = 0; const reqType = new Map();
  cdp.on('Network.responseReceived', (e) => reqType.set(e.requestId, e.type));
  cdp.on('Network.loadingFinished', (e) => { if (reqType.get(e.requestId) === 'Script') jsBytes += e.encodedDataLength; });
  await page.addInitScript(() => { window.__lt = []; new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push([e.startTime, e.duration]))).observe({ type: 'longtask', buffered: true }); });
  const t0 = Date.now();
  await page.goto(origin + route, { waitUntil: 'load', timeout: 120000 });
  const loadMs = Date.now() - t0;
  await page.waitForTimeout(3000);
  const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
  const lt = await page.evaluate(() => window.__lt);
  const tbt = Math.round(lt.reduce((a, [, d]) => a + Math.max(0, d - 50), 0));
  results.push({ run: i, route: r0 === '/produto/__PDP__' ? '/produto/[slug]' : r0, loadMs, jsKB: Math.round(jsBytes / 1024), scriptMs: Math.round(m.ScriptDuration * 1000), taskMs: Math.round(m.TaskDuration * 1000), longTasks: lt.length, tbtLike: tbt, jsErrors: errors.length });
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${out}/hydrate.json`, JSON.stringify({ origin, label, cpu: 4, network: '150ms RTT ~1.6Mbps, cache off', results }, null, 2));
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
for (const r of [...new Set(results.map((x) => x.route))]) {
  const rs = results.filter((x) => x.route === r);
  console.log(label, r.padEnd(16), 'jsKB', med(rs.map((x) => x.jsKB)), 'scriptMs', med(rs.map((x) => x.scriptMs)), 'taskMs', med(rs.map((x) => x.taskMs)), 'longTasks', med(rs.map((x) => x.longTasks)), 'tbt', med(rs.map((x) => x.tbtLike)), 'load', med(rs.map((x) => x.loadMs)), 'err', rs.reduce((a, x) => a + x.jsErrors, 0));
}
