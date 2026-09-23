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
assert.ok(layout.includes("themeColor: '#0a0a0a'"), 'theme color stays Schimitz black');

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
  'promo paints above the sticky header safe-area fill',
);

const heads = [...css.matchAll(/\.site-chrome-head\s*\{([^}]*)\}/g)];
assert.equal(heads.length, 2, 'base and mobile sticky chrome rules');
for (const head of heads) {
  assert.match(head[1], /position:\s*sticky/, 'header stays sticky');
  assert.match(head[1], /top:\s*var\(--safe-area-top\)/, 'stuck header clears the status bar');
  assert.equal(/top:\s*0/.test(head[1]), false, 'stuck header must not pin to y=0');
}
assert.match(
  css,
  /\.site-chrome-head::before\s*\{[^}]*height:\s*var\(--safe-area-top\)[^}]*background:\s*var\(--header-bg\)/,
  'header background fills the inset when the promo has scrolled away',
);

assert.match(css, /\.nav-progress\s*\{[^}]*top:\s*var\(--safe-area-top\)/, 'route progress sits below the status bar');

assert.ok(header.includes('className="topbar"'), 'yellow promo strip stays');
assert.ok(
  header.indexOf('topbar') < header.indexOf('site-chrome-head'),
  'promo stays outside the sticky wrapper',
);
assert.equal(/className="topbar"[\s\S]{0,400}site-chrome-head/.test(header), true, 'strip still precedes the black header');

console.log('safe-area-chrome tests ok');
