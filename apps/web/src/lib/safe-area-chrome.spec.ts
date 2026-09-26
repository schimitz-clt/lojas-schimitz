import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const srcRoot = join(__dirname, '..');
const layout = readFileSync(join(srcRoot, 'app/layout.tsx'), 'utf8');
const css = readFileSync(join(srcRoot, 'app/globals.css'), 'utf8');
const header = readFileSync(join(srcRoot, 'components/Header.tsx'), 'utf8');

assert.ok(layout.includes("viewportFit: 'cover'"), 'viewport-fit=cover so safe-area env vars are non-zero');
assert.ok(layout.includes('maximumScale: 1'), 'page zoom lock stays');
assert.ok(layout.includes('userScalable: false'), 'pinch zoom stays off');
assert.ok(layout.includes("themeColor: '#07122A'"), 'theme color is the storefront navy');

assert.ok(/--safe-area-top:\s*0px/.test(css), 'inset defaults to 0 so desktop does not grow');
assert.ok(
  /--safe-area-top:\s*constant\(safe-area-inset-top\)/.test(css),
  'constant() fallback for iOS 11.0–11.2',
);
assert.ok(
  /--safe-area-top:\s*env\(safe-area-inset-top,\s*0px\)/.test(css),
  'env(safe-area-inset-top) is the live inset',
);
const safeDecl = css.match(/--safe-area-top:\s*0px;[\s\S]*?--safe-area-top:\s*constant\(safe-area-inset-top\);[\s\S]*?--safe-area-top:\s*env\(safe-area-inset-top,\s*0px\);/);
assert.ok(safeDecl, 'fallback order is 0px, then constant(), then env()');

assert.ok(
  /\.topbar\s*\{[^}]*padding:\s*7px 12px;[^}]*padding-top:\s*calc\(7px \+ var\(--safe-area-top\)\)/.test(css),
  'desktop promo keeps 7px and adds only the inset',
);
assert.ok(
  /@media \(max-width: 720px\)[\s\S]*?\.topbar\s*\{[^}]*padding:\s*5px 10px;[^}]*padding-top:\s*calc\(5px \+ var\(--safe-area-top\)\)/.test(
    css,
  ),
  'mobile promo keeps 5px and adds only the inset',
);
assert.ok(
  /\.topbar\s*\{[^}]*z-index:\s*46/.test(css),
  'promo paints above the black header inside the stack',
);

const stack = css.match(/\.site-chrome\s*\{([^}]*)\}/);
assert.ok(stack, 'sticky chrome stack exists');
assert.match(stack[1], /position:\s*sticky/, 'yellow + black + address pin together');
assert.match(stack[1], /top:\s*0/, 'stack pins at y=0; the promo padding owns the status-bar inset');

const heads = [...css.matchAll(/\.site-chrome-head\s*\{([^}]*)\}/g)];
assert.equal(heads.length, 2, 'base and mobile black-header rules');
for (const head of heads) {
  assert.equal(/position:\s*sticky/.test(head[1]), false, 'black header is not a second sticky layer');
  assert.equal(
    /top:\s*var\(--safe-area-top\)/.test(head[1]),
    false,
    'black header does not offset by the inset (that gaps it under the yellow)',
  );
}
assert.equal(
  /\.site-chrome-head::before\s*\{/.test(css),
  false,
  'no black inset fill — the pinned yellow already covers the status bar',
);

assert.match(css, /\.nav-progress\s*\{[^}]*top:\s*var\(--safe-area-top\)/, 'route progress sits below the status bar');

assert.ok(header.includes('className="topbar"'), 'yellow promo strip stays');
assert.ok(header.includes('className="site-chrome"'), 'sticky stack wrapper');
const chromeAt = header.indexOf('className="site-chrome"');
const topbarAt = header.indexOf('className="topbar"');
const headAt = header.indexOf('site-chrome-head');
const addressAt = header.indexOf('<HomeDeliveryBar');
assert.ok(chromeAt >= 0 && chromeAt < topbarAt && topbarAt < headAt && headAt < addressAt, 'yellow, black header, then address share one sticky stack');
assert.equal(/className="topbar"[\s\S]{0,400}site-chrome-head/.test(header), true, 'strip still precedes the black header');

console.log('safe-area-chrome tests ok');
