/**
 * Guards for Improvement 3 (mobile speed). Source-level checks (same style as other *-ui specs):
 * regressions here silently bring back desktop PNGs on phones or the header pop-in (CLS 0.14).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');

// 1) Header is server-rendered: not inside a Suspense boundary in the chrome…
const chrome = src('components/StorefrontChrome.tsx');
const suspenseBlock = chrome.slice(chrome.indexOf('<Suspense'), chrome.indexOf('</Suspense>'));
assert.ok(!suspenseBlock.includes('<Header'), 'Header must not be wrapped in Suspense (client-only on static routes)');
assert.ok(chrome.includes('<Header />'));
// …and it does not call useSearchParams itself (only the isolated CatalogSearchSync child does).
const header = src('components/Header.tsx');
const headerBody = header.slice(header.indexOf('export function Header()'));
assert.ok(!headerBody.includes('useSearchParams('), 'useSearchParams belongs in CatalogSearchSync only');
assert.ok(header.includes('<Suspense fallback={null}>') && header.includes('<CatalogSearchSync'));

// 2) Upload photos get responsive srcSet in every storefront image component.
for (const f of ['components/ProductCard.tsx', 'components/HomeBanners.tsx', 'components/RetailHome.tsx', 'components/ProductGallery.tsx']) {
  assert.ok(src(f).includes('responsiveImageProps('), `${f} must use responsiveImageProps`);
}
// 3) LCP preload matches the <img> (srcSet + sizes) — otherwise the photo downloads twice.
const page = src('app/page.tsx');
assert.ok(page.includes('imageSrcSet') && page.includes('STAGE_IMG_SIZES'));
assert.ok(src('components/RetailHome.tsx').includes('sizes={STAGE_IMG_SIZES}'));

console.log('mobile-speed.spec OK');
