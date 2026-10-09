// Mede a rolagem: frames lentos (rAF) e long tasks durante um scroll contínuo, com CPU 4x mais lenta.
const { chromium } = require('playwright-core');
const base = process.argv[2] || 'https://lojasschimitz.com.br';
const tag = process.argv[3] || 'x';
const paths = (process.argv[4] || '/,/produtos,/departamento/celulares').split(',');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const out = [];
  for (const path of paths) for (const mode of ['mobile', 'desktop']) {
    const m = mode === 'mobile';
    const c = await b.newContext({ viewport: m ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: m ? 2 : 1, isMobile: m, hasTouch: m });
    const p = await c.newPage();
    const cdp = await c.newCDPSession(p);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await p.goto(base + path, { waitUntil: 'networkidle' });
    await p.waitForTimeout(2500);
    await p.evaluate(() => {
      window.__f = []; window.__lt = [];
      let last = performance.now();
      const tick = (t) => { window.__f.push(t - last); last = t; requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push(e.duration))).observe({ type: 'longtask', buffered: false }); } catch {}
    });
    const total = await p.evaluate(() => document.documentElement.scrollHeight);
    const dist = Math.min(total - 900, 9000);
    // gesto de rolagem real (inércia como no toque/roda)
    if (m) await cdp.send('Input.synthesizeScrollGesture', { x: 200, y: 600, yDistance: -dist, speed: 2500, gestureSourceType: 'touch' });
    else { for (let i = 0; i < dist / 120; i++) { await p.mouse.wheel(0, 120); await p.waitForTimeout(16); } }
    await p.waitForTimeout(800);
    const r = await p.evaluate(() => {
      const f = window.__f.slice(2).sort((a, b) => a - b); const n = f.length; const q = (x) => f[Math.min(n - 1, Math.floor(n * x))];
      const lt = window.__lt;
      return { frames: n, p50: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), p99: +q(0.99).toFixed(1), max: +f[n - 1].toFixed(1), over50: f.filter((x) => x > 50).length, over100: f.filter((x) => x > 100).length, longtasks: lt.length, ltTotal: Math.round(lt.reduce((a, b) => a + b, 0)), ltMax: Math.round(Math.max(0, ...lt)) };
    });
    const nodes = await p.evaluate(() => document.getElementsByTagName('*').length);
    out.push({ path, mode, scrolled: dist, nodes, ...r });
    console.log(JSON.stringify(out[out.length - 1]));
    await c.close();
  }
  require('fs').writeFileSync(`scroll-${tag}.json`, JSON.stringify(out, null, 1));
  await b.close();
})();
