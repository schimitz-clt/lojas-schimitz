import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const webRoot = join(__dirname, '../..');
const srcRoot = join(__dirname, '..');
const repoRoot = join(webRoot, '../..');

function pngSize(path: string): { width: number; height: number } {
  const buf = readFileSync(path);
  assert.equal(buf.subarray(0, 8).toString('binary'), '\x89PNG\r\n\x1a\n', path);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function mustPng(rel: string, width: number, height: number) {
  const path = join(webRoot, rel);
  assert.ok(existsSync(path), `missing ${rel}`);
  const size = pngSize(path);
  assert.equal(size.width, width, `${rel} width`);
  assert.equal(size.height, height, `${rel} height`);
}

mustPng('public/favicon-16x16.png', 16, 16);
mustPng('public/favicon-32x32.png', 32, 32);
mustPng('public/apple-touch-icon.png', 180, 180);
mustPng('src/app/apple-icon.png', 180, 180);
mustPng('public/android-chrome-192x192.png', 192, 192);
mustPng('public/android-chrome-512x512.png', 512, 512);
mustPng('public/icon-maskable-192x192.png', 192, 192);
mustPng('public/icon-maskable-512x512.png', 512, 512);
mustPng('public/icons/schimitz-icon.png', 1024, 1024);
mustPng('public/icons/schimitz-icon-fill-life.png', 1024, 1024);

assert.ok(existsSync(join(webRoot, 'public/favicon.ico')), 'public/favicon.ico');
assert.equal(existsSync(join(webRoot, 'src/app/favicon.ico')), false, 'no app/favicon.ico conflict');

mustPng('../mobile/store/icon-512.png', 512, 512);
mustPng('../mobile/store/play-listing-icon-512-source.png', 512, 512);
mustPng('../mobile/app/src/main/res/drawable/ic_launcher.png', 512, 512);
mustPng('../mobile/app/src/main/res/drawable/ic_launcher_foreground.png', 1080, 1080);

assert.equal(existsSync(join(repoRoot, 'apps/mobile/app/src/main/res/drawable/ic_launcher.xml')), false);
assert.equal(
  existsSync(join(repoRoot, 'apps/mobile/app/src/main/res/drawable/ic_launcher_foreground.xml')),
  false,
);

const layout = readFileSync(join(srcRoot, 'app/layout.tsx'), 'utf8');
assert.ok(layout.includes("url: '/favicon-16x16.png'"), 'layout wires 16px favicon');
assert.ok(layout.includes("url: '/favicon-32x32.png'"), 'layout wires 32px favicon');
assert.ok(layout.includes("url: '/apple-touch-icon.png'"), 'layout wires apple-touch');
assert.ok(layout.includes("url: '/android-chrome-192x192.png'"), 'layout wires 192');
assert.ok(layout.includes("url: '/android-chrome-512x512.png'"), 'layout wires 512');
assert.ok(layout.includes("manifest: '/manifest.webmanifest'"), 'layout points at PWA manifest');
assert.ok(layout.includes('themeColor:'), 'theme color on viewport');
assert.ok(layout.includes('maximumScale: 1'), 'viewport locks maximum page scale');
assert.ok(layout.includes('userScalable: false'), 'viewport disables page pinch zoom');
assert.ok(layout.includes("viewportFit: 'cover'"), 'viewport-fit=cover enables safe-area insets');

const manifest = readFileSync(join(srcRoot, 'app/manifest.ts'), 'utf8');
assert.ok(manifest.includes("src: '/android-chrome-192x192.png'"), 'manifest any 192');
assert.ok(manifest.includes("src: '/android-chrome-512x512.png'"), 'manifest any 512');
assert.ok(manifest.includes("src: '/icon-maskable-192x192.png'"), 'manifest maskable 192');
assert.ok(manifest.includes("src: '/icon-maskable-512x512.png'"), 'manifest maskable 512');
assert.ok(manifest.includes("purpose: 'maskable'"), 'maskable purpose');
assert.ok(manifest.includes("purpose: 'any'"), 'any purpose');

const nav = readFileSync(join(srcRoot, 'components/BottomNav.tsx'), 'utf8');
assert.ok(nav.includes("label: 'Conta'"), 'Conta label unchanged');
assert.ok(nav.includes("iconSrc: '/android-chrome-192x192.png'"), 'Conta uses brand 192');
assert.ok(!/label: 'Conta'[\s\S]{0,80}ico: '👤'/.test(nav), 'Conta no longer uses person glyph');
assert.ok(!/ico: '🏠'/.test(nav), 'home tab no longer uses house emoji');
assert.ok(nav.includes("icon: 'home'"), 'home tab uses unified SVG icon id');
assert.ok(nav.includes('BottomNavGlyph'), 'bottom nav renders shared stroke glyphs');
assert.ok(nav.includes("icon: 'search'"), 'search tab uses unified SVG icon id');
assert.ok(nav.includes("icon: 'cart'"), 'cart tab uses unified SVG icon id');
assert.ok(nav.includes("icon: 'heart'"), 'salvos tab uses unified SVG icon id');

const icons = readFileSync(join(srcRoot, 'components/icons/StorefrontIcons.tsx'), 'utf8');
assert.ok(icons.includes('ICON_STROKE'), 'shared stroke token');
assert.ok(icons.includes('IconHome'), 'home glyph');
assert.ok(icons.includes('IconSearch'), 'search glyph');
assert.ok(icons.includes('IconCart'), 'cart glyph');
assert.ok(icons.includes('IconHeart'), 'heart glyph');
assert.ok(icons.includes('HomeShortcutGlyph'), 'home shortcut glyphs');
assert.ok(/strokeWidth:\s*ICON_STROKE|strokeWidth:\s*1\.8/.test(icons), 'consistent stroke weight');

const shortcuts = readFileSync(join(srcRoot, 'components/HomeShortcuts.tsx'), 'utf8');
assert.ok(shortcuts.includes('HomeShortcutGlyph'), 'shortcuts use shared set');
assert.ok(!/fill=\"currentColor\"/.test(shortcuts), 'shortcut icons are no longer heavy filled silhouettes');

const search = readFileSync(join(srcRoot, 'components/SearchBox.tsx'), 'utf8');
assert.ok(search.includes('IconSearch'), 'search submit uses SVG');
assert.ok(!search.includes('🔍'), 'search submit dropped emoji');

const header = readFileSync(join(srcRoot, 'components/Header.tsx'), 'utf8');
assert.ok(header.includes('LOJAS <span>SCHIMITZ</span>'), 'header wordmark text unchanged');
assert.ok(header.includes('IconCart'), 'header cart uses SVG');
assert.ok(!header.includes('🛒'), 'header cart dropped emoji');

const catOfertas = readFileSync(join(webRoot, 'public/cats/ofertas.svg'), 'utf8');
assert.ok(!/<rect[^>]*width=\"120\"[^>]*fill=/.test(catOfertas), 'category fallbacks are transparent over yellow chips');
assert.ok(catOfertas.includes('stroke="#0a0a0a"'), 'category strokes stay ink');
assert.ok(catOfertas.includes('#FFD100'), 'category accents keep Schimitz yellow');
const adaptive = readFileSync(
  join(repoRoot, 'apps/mobile/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml'),
  'utf8',
);
assert.ok(adaptive.includes('@drawable/ic_launcher_foreground'), 'adaptive uses PNG foreground');
assert.ok(adaptive.includes('@color/ic_launcher_background'), 'adaptive keeps color background');

console.log('brand-icons tests ok');
