import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PDP_GALLERY_ASPECT_CSS,
  pdpGalleryFrameSize,
  pdpGalleryHeightCapShrinksWidth,
  pdpGallerySlideWidthLock,
  pdpPageOverflowX,
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

assert.equal(pdpPageOverflowX(), 'hidden');

assert.ok(/html, body[\s\S]{0,180}overflow-x:\s*hidden/.test(css), 'document must not scroll sideways');
assert.ok(/\.pdp\s*\{[^}]*overflow-x:\s*hidden/.test(css), 'PDP hides horizontal overflow');
assert.ok(/\.pdp-carousel-track[\s\S]{0,280}scroll-snap-type:\s*x mandatory/.test(css), 'gallery swipe is internal scroll-snap');
assert.ok(/\.pdp-carousel-track[\s\S]{0,280}overflow-x:\s*auto/.test(css), 'only the track scrolls horizontally');
assert.ok(/\.pdp-carousel-slide\s*\{[^}]*scroll-snap-stop:\s*always/.test(css), 'gallery snaps one photo at a time');
assert.ok(theme.includes('scroll-snap-stop: always'), 'lightbox snaps one photo at a time');
assert.ok(/minmax\(min\(100%,\s*140px\)/.test(css), 'trust cards cannot force a 140px×3 overflow');
assert.ok(/\.pdp-gallery-col[\s\S]*margin-left:\s*-12px/.test(css), 'mobile gallery bleeds to wrap edges');
assert.ok(/\.pdp-carousel-nav[\s\S]*display:\s*none/.test(css), 'mobile uses swipe + dots, not side arrows');
assert.ok(/\.pdp-carousel-dots[\s\S]*position:\s*static/.test(css), 'dots sit under the photo, centered');
assert.ok(/\.pdp-sticky-atc \.btn[\s\S]*white-space:\s*nowrap/.test(css), 'sticky ATC is price left + button right');
assert.ok(
  /@media \(max-width: 720px\)[\s\S]*\.pdp-actions\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/.test(css),
  'mobile buy CTAs sit in a 2-col grid (Adicionar / Comparar / Favoritar / WhatsApp)',
);
assert.ok(/\.pdp-title-row\s*\{[^}]*display:\s*flex/.test(css), 'name and rating share one Magalu header row');

assert.ok(theme.includes('touch-action: pan-x'), 'photo hit-target allows horizontal swipe');
assert.ok(theme.includes('object-position: center'), 'theme img also centers in the frame');

console.log('pdp-gallery-layout unit tests ok');
