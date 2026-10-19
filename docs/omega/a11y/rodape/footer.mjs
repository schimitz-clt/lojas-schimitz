// node footer.mjs <origin> <label> — tamanho da área de toque dos links do rodapé + screenshot do rodapé (412 px, toque)
import { chromium } from 'playwright-core';
const [origin, label] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--host-resolver-rules=MAP loja.test 127.0.0.1', '--ignore-certificate-errors'] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true }); const page = await ctx.newPage();
await page.goto(origin + '/', { waitUntil: 'networkidle' });
const r = await page.evaluate(() => {
  const links = [...document.querySelectorAll('.footer-col ul a')].map((a) => { const b = a.getBoundingClientRect(); return [a.textContent.trim(), Math.round(b.width), Math.round(b.height)]; });
  const f = document.querySelector('.footer'); const fs = getComputedStyle(document.querySelector('.footer-col ul a'));
  return { links, minH: Math.min(...links.map((l) => l[2])), minW: Math.min(...links.map((l) => l[1])), footerH: Math.round(f.getBoundingClientRect().height), font: fs.fontSize + ' ' + fs.color };
});
await page.locator('.footer').screenshot({ path: `/workspace/ls-final-evidence/a11y/${label}-footer.png` });
console.log(label, JSON.stringify({ minH: r.minH, minW: r.minW, footerH: r.footerH, font: r.font, n: r.links.length }));
await browser.close();
