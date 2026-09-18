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
assert.ok(existsSync(join(webRoot, 'src/app/favicon.ico')), 'app/favicon.ico');

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
assert.ok(nav.includes("ico: '🏠'"), 'other tabs stay emoji');

const header = readFileSync(join(srcRoot, 'components/Header.tsx'), 'utf8');
assert.ok(header.includes('LOJAS <span>SCHIMITZ</span>'), 'header wordmark text unchanged');

const adaptive = readFileSync(
  join(repoRoot, 'apps/mobile/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml'),
  'utf8',
);
assert.ok(adaptive.includes('@drawable/ic_launcher_foreground'), 'adaptive uses PNG foreground');
assert.ok(adaptive.includes('@color/ic_launcher_background'), 'adaptive keeps color background');

console.log('brand-icons tests ok');
