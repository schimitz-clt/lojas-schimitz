import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SEARCH_OPEN_CLASS,
  SEARCH_RESULTS_CLASS,
  chromeStackHeight,
  chromeVisualTop,
  filterBarStickyTop,
  shouldPinSearchChrome,
} from './search-chrome';

assert.equal(chromeVisualTop(0), 0);
assert.equal(chromeVisualTop(-4), 0);
assert.equal(chromeVisualTop(Number.NaN), 0);
assert.equal(chromeVisualTop(12.345), 12.35);
assert.equal(chromeStackHeight(0), 0);
assert.equal(chromeStackHeight(140.2), 140);
assert.equal(filterBarStickyTop(140.2), '140px');
assert.equal(filterBarStickyTop(0), '0px');
assert.equal(shouldPinSearchChrome({ searchOpen: false, searchResults: false }), false);
assert.equal(shouldPinSearchChrome({ searchOpen: true, searchResults: false }), true);
assert.equal(shouldPinSearchChrome({ searchOpen: false, searchResults: true }), true);

const srcRoot = join(__dirname, '..');
const css = readFileSync(join(srcRoot, 'app/globals.css'), 'utf8');
const header = readFileSync(join(srcRoot, 'components/Header.tsx'), 'utf8');
const layout = readFileSync(join(srcRoot, 'app/layout.tsx'), 'utf8');
const theme = readFileSync(join(srcRoot, 'components/storefront/storefront-theme.css'), 'utf8');
const box = readFileSync(join(srcRoot, 'components/SearchBox.tsx'), 'utf8');

assert.equal(SEARCH_OPEN_CLASS, 'search-open');
assert.equal(SEARCH_RESULTS_CLASS, 'search-results');
assert.ok(
  /\.site-chrome\s*\{[^}]*position:\s*sticky/.test(css),
  'home chrome stays sticky so yellow, search, and address share one track',
);
assert.ok(css.includes(`html.${SEARCH_OPEN_CLASS} .site-chrome`), 'open search pins the stack');
assert.ok(css.includes(`html.${SEARCH_RESULTS_CLASS} .site-chrome`), 'results pin the stack');
assert.ok(
  /html\.search-results \.site-chrome\s*\{[^}]*position:\s*fixed/.test(css),
  'results chrome is fixed so scroll-up cannot leave the bar lower on the screen',
);
assert.ok(css.includes('top: var(--vv-top, 0px)'), 'keyboard offset keeps the open search bar on the visual top');
assert.match(
  css,
  /html\.search-results \.site-chrome\s*\{[^}]*top:\s*0;/,
  'results chrome stays at the top of the screen while the page scrolls',
);
assert.ok(css.includes('padding-top: var(--site-chrome-h, 168px)'), 'fixed chrome keeps its place in the flow');
assert.ok(css.includes('overflow-anchor: none'), 'scroll anchoring cannot drag the bar');
assert.ok(header.includes('visualViewport'), 'header follows the visual viewport');
assert.ok(header.includes('SEARCH_RESULTS_CLASS'), 'results mode toggles the pin class');
assert.ok(header.includes('className="site-chrome"'), 'sticky stack wrapper stays');
assert.ok(header.includes('--site-chrome-h'), 'live chrome height feeds the filter offset');
assert.ok(box.includes('SEARCH_OPEN_CLASS'), 'suggestion panel toggles the pin class');
assert.ok(box.includes("addEventListener('touchmove'"), 'open panel does not scroll the page under the bar');
assert.ok(
  /\.sf-filter-bar\s*\{[^}]*top:\s*var\(--site-chrome-h/.test(theme),
  'filter bar sticks under the chrome',
);
assert.match(
  theme,
  /\.sf-filter-bar \{\n {4}top: var\(--site-chrome-h, 168px\);/,
  'mobile filter bar uses the chrome offset',
);
assert.ok(layout.includes("interactiveWidget: 'resizes-content'"), 'keyboard resizes layout instead of pushing the bar');

console.log('search-chrome unit tests ok');
