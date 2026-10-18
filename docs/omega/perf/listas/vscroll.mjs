// node vscroll.mjs <url> <label> — touch-scroll a page down/up (CPU 4x), compositor + main-thread cost
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const [url, label] = process.argv.slice(2);
const out = `/workspace/ls-final-evidence/lists/${label}`; fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--disable-gpu', '--host-resolver-rules=MAP loja.test 127.0.0.1', '--ignore-certificate-errors'] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true });
const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page);
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 }); await page.waitForTimeout(2000);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await page.evaluate(() => { window.__lt = []; new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push(e.duration))).observe({ type: 'longtask' }); });
await browser.startTracing(page, { path: `${out}/trace.json`, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'cc', 'viz', 'benchmark'] });
const ys = [];
for (let i = 0; i < 10; i++) {
  const dir = i < 6 ? -1 : 1; const x = 206, y0 = dir < 0 ? 760 : 260, dist = dir * 480, steps = 12;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
  for (let s = 1; s <= steps; s++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + (dist * s) / steps }] }); await new Promise((r) => setTimeout(r, 16)); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(900); ys.push(await page.evaluate(() => Math.round(scrollY)));
}
await browser.stopTracing();
const lt = await page.evaluate(() => window.__lt);
const tr = JSON.parse(fs.readFileSync(`${out}/trace.json`, 'utf8')); const ev = tr.traceEvents || tr;
const sum = (n) => +(ev.filter((e) => e.name === n && e.ph === 'X').reduce((a, e) => a + (e.dur || 0), 0) / 1000).toFixed(1);
const pr = ev.filter((e) => e.name === 'PipelineReporter' && e.ph === 'b' && e.args?.frame_reporter).map((e) => e.args.frame_reporter);
const scr = pr.filter((f) => f.scroll_state && f.scroll_state !== 'SCROLL_NONE');
const res = { url, label, cpu: 4, scrollYAfterEach: ys, longTasks: lt.length,
  framesDuringScroll: scr.length, framesDroppedDuringScroll: scr.filter((f) => f.state === 'STATE_DROPPED').length,
  compositorDrawMs: sum('DirectRenderer::DrawRenderPass'), softwareDrawQuadMs: sum('SoftwareRenderer::DoDrawQuad'), rasterMs: sum('RasterTask'),
  paintMs: sum('Paint'), layoutMs: sum('Layout'), styleMs: sum('UpdateLayoutTree'), scriptMs: sum('FunctionCall'), jsErrors: errors };
fs.writeFileSync(`${out}/vscroll.json`, JSON.stringify(res, null, 2)); fs.rmSync(`${out}/trace.json`);
console.log(JSON.stringify(res));
await browser.close();
