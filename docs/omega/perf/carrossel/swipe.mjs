// Usage: node swipe.mjs <url> <label> [--gpu]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const [url, label] = process.argv.slice(2);
const gpu = process.argv.includes('--gpu');
const out = `/workspace/ls-final-evidence/carousel/${label}`;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
  args: [...(gpu ? [] : ['--disable-gpu', '--disable-gpu-compositing']), '--host-resolver-rules=MAP loja.test 127.0.0.1', '--ignore-certificate-errors'] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A135M Build/TP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.0.0 Mobile Safari/537.36 LojasSchimitzApp/1.0.14' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const cdp = await ctx.newCDPSession(page);
await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForSelector('.home-banner-track', { timeout: 30000 });
await page.waitForTimeout(1500);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await cdp.send('Performance.enable');
const box = await page.locator('.home-banner-track').boundingBox();
await page.evaluate(() => {
  window.__m = { frames: [], long: [], loaf: [], renders: 0 };
  let last = performance.now();
  const tick = (t) => { window.__m.frames.push(t - last); last = t; window.__raf = requestAnimationFrame(tick); };
  window.__raf = requestAnimationFrame(tick);
  new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__m.long.push(e.duration))).observe({ type: 'longtask', buffered: false });
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__m.loaf.push({ d: e.duration, block: e.blockingDuration }))).observe({ type: 'long-animation-frame' }); } catch {}
  const track = document.querySelector('.home-banner-track');
  window.__mut = 0;
  new MutationObserver((ms) => { window.__mut += ms.length; }).observe(track.closest('.home-banners'), { subtree: true, attributes: true, childList: true, characterData: true });
});
const before = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
await browser.startTracing(page, { path: `${out}/trace.json`, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'blink.user_timing', 'cc', 'viz'] });
const t0 = Date.now(); const scrolls = [await page.evaluate(() => Math.round(document.querySelector('.home-banner-track').scrollLeft))];
for (let i = 0; i < 8; i++) {
  const dir = i % 4 === 3 ? 1 : -1; // mostly forward, occasionally back
  const cx = Math.round(box.x + box.width / 2), cy = Math.round(box.y + box.height / 2);
  const dist = dir * Math.round(box.width * 0.6), steps = 14;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx - dist / 2, y: cy }] });
  for (let s = 1; s <= steps; s++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx - dist / 2 + (dist * s) / steps, y: cy + s * 0.5 }] });
    await new Promise((r) => setTimeout(r, 16));
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(700);
  scrolls.push(await page.evaluate(() => Math.round(document.querySelector('.home-banner-track').scrollLeft)));
}
const elapsed = Date.now() - t0;
await browser.stopTracing();
const after = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
const m = await page.evaluate(() => { cancelAnimationFrame(window.__raf); return { ...window.__m, mut: window.__mut, scrollLeft: document.querySelector('.home-banner-track').scrollLeft, slides: document.querySelectorAll('.home-banner-slide').length }; });
const f = m.frames.slice(1);
const budget = 1000 / 60;
const dropped = f.reduce((a, d) => a + Math.max(0, Math.round(d / budget) - 1), 0);
const delta = (k) => +((after[k] - before[k]) * 1000).toFixed(1);
// trace-based compositor frame stats
const tr = JSON.parse(fs.readFileSync(`${out}/trace.json`, 'utf8'));
const ev = tr.traceEvents || tr;
const cnt = (n) => ev.filter((e) => e.name === n).length;
const sumDur = (n) => +(ev.filter((e) => e.name === n && e.dur).reduce((a, e) => a + e.dur, 0) / 1000).toFixed(1);
const res = { url, label, gpu, cpuThrottle: 4, gestureWindowMs: elapsed, rafFrames: f.length, droppedFramesRaf: dropped,
  framesOver50ms: f.filter((d) => d > 50).length, worstFrameMs: +Math.max(...f).toFixed(1), p95FrameMs: +f.sort((a, b) => a - b)[Math.floor(f.length * 0.95)].toFixed(1),
  longTasks: m.long.length, longTaskTotalMs: +m.long.reduce((a, b) => a + b, 0).toFixed(1), longAnimFrames: m.loaf.length,
  carouselDomMutations: m.mut, slides: m.slides,
  mainThread: { scriptMs: delta('ScriptDuration'), layoutMs: delta('LayoutDuration'), styleMs: delta('RecalcStyleDuration'), taskMs: delta('TaskDuration') },
  trace: { paintEvents: cnt('Paint'), paintMs: sumDur('Paint'), rasterMs: sumDur('RasterTask'), layoutEvents: cnt('Layout'), styleEvents: cnt('UpdateLayoutTree'), droppedFrameEvents: cnt('DroppedFrame') + cnt('Graphics.Pipeline') * 0, decodeMs: sumDur('Decode Image') + sumDur('ImageDecodeTask') },
  scrollLeftAfterEachSwipe: scrolls, jsErrors: errors };
fs.writeFileSync(`${out}/swipe.json`, JSON.stringify(res, null, 2));
await page.screenshot({ path: `${out}/after-swipes.png` });
console.log(JSON.stringify(res, null, 2));
await browser.close();
