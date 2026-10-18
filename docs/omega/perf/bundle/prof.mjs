// node prof.mjs <origin> <route> — CPU profile of cold load (CPU 4x), self time by script and top functions
import { chromium } from 'playwright-core';
const [origin, route] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--host-resolver-rules=MAP loja.test 127.0.0.1', '--ignore-certificate-errors'] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true });
const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start');
await page.goto(origin + route, { waitUntil: 'load' }); await page.waitForTimeout(3000);
const { profile } = await cdp.send('Profiler.stop');
const dt = {}; profile.samples.forEach((id, i) => { dt[id] = (dt[id] || 0) + (profile.timeDeltas[i] || 0); });
const byUrl = {}, byFn = {};
for (const n of profile.nodes) { const t = (dt[n.id] || 0) / 1000; if (!t) continue; const u = (n.callFrame.url || '(native)').split('/').pop().slice(0, 40); byUrl[u] = (byUrl[u] || 0) + t; const k = `${n.callFrame.functionName || '(anon)'} @${u}:${n.callFrame.lineNumber}:${n.callFrame.columnNumber}`; byFn[k] = (byFn[k] || 0) + t; }
const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${v.toFixed(0).padStart(6)} ${k}`).join('\n');
console.log('== by script\n' + top(byUrl, 15) + '\n== by function\n' + top(byFn, 25));
await browser.close();
