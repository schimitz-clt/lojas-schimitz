import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PDP_GALLERY_ASPECT_CSS,
  pdpGalleryFrameSize,
  pdpGalleryHeightCapShrinksWidth,
  pdpGallerySlideWidthLock,
} from './pdp-gallery-layout';

assert.deepEqual(pdpGalleryFrameSize(390), { width: 390, height: 390 });
assert.deepEqual(pdpGalleryFrameSize(360), { width: 360, height: 360 });
assert.deepEqual(pdpGalleryFrameSize(0), { width: 0, height: 0 });
assert.deepEqual(pdpGalleryFrameSize(-20), { width: 0, height: 0 });
assert.deepEqual(pdpGalleryFrameSize(Number.NaN), { width: 0, height: 0 });

assert.equal(PDP_GALLERY_ASPECT_CSS, '1 / 1');

/* 390px phone + PR #31 200px cap → width would collapse (the live Android bug). */
assert.equal(pdpGalleryHeightCapShrinksWidth(390, 200), true);
assert.equal(pdpGalleryHeightCapShrinksWidth(360, 280), true);
assert.equal(pdpGalleryHeightCapShrinksWidth(390, 390), false);
assert.equal(pdpGalleryHeightCapShrinksWidth(390, 420), false);

assert.deepEqual(pdpGallerySlideWidthLock(), [
  'flex: 0 0 100%',
  'width: 100%',
  'min-width: 100%',
  'max-width: 100%',
]);

const css = readFileSync(join(__dirname, '../app/globals.css'), 'utf8');
const theme = readFileSync(join(__dirname, '../components/storefront/storefront-theme.css'), 'utf8');

assert.ok(css.includes('min-width: 100%'), 'slides lock to track width (not img intrinsic)');
assert.ok(css.includes('max-width: 100%'), 'slides cannot grow past the track');
assert.ok(/\.pdp-carousel-slide\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1/.test(css), 'square 1/1 frame');
assert.ok(/\.pdp-carousel-slide\s*\{[^}]*height:\s*auto/.test(css), 'height comes from aspect-ratio, not a short cap');
assert.ok(css.includes('object-position: center'), 'photo centered in the frame');
assert.ok(/\.pdp-thumbs\s*\{[^}]*justify-content:\s*center/.test(css), 'thumbnails centered under the frame');
assert.ok(/\.pdp-gallery\s*\{[^}]*min-width:\s*0/.test(css), 'gallery can shrink inside the PDP grid');

assert.equal(
  /height:\s*min\(28vh,\s*200px\)/.test(css) || /height:\s*min\(38vh,\s*280px\)/.test(css),
  false,
  'must not set a short explicit height on the carousel (fights aspect-ratio)',
);
assert.equal(
  /@media \(max-width: 420px\)[\s\S]*\.pdp-carousel[\s\S]*height:\s*min\(28/.test(css),
  false,
  '390px breakpoint must not reintroduce the 28vh/200px strip',
);

assert.ok(
  /@media \(max-width: 720px\)[\s\S]*\.pdp-sticky-atc[\s\S]*bottom:\s*calc\(72px/.test(css),
  'sticky ATC stays above the 72px bottom nav',
);

assert.ok(theme.includes('justify-self: stretch'), 'Ampliar hit-target fills the slide');
assert.ok(theme.includes('object-position: center'), 'theme img also centers in the frame');

console.log('pdp-gallery-layout unit tests ok');
