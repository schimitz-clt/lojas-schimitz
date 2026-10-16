import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { shouldSkipBannerAutoplay } from './banner-autoplay';

assert.equal(shouldSkipBannerAutoplay(null), true);
assert.equal(shouldSkipBannerAutoplay({}), true);
assert.equal(shouldSkipBannerAutoplay({ matchMedia: () => ({ matches: true }) }), true);
assert.equal(shouldSkipBannerAutoplay({ matchMedia: () => ({ matches: false }) }), false);
const src = readFileSync(join(__dirname, '../components/HomeBanners.tsx'), 'utf8');
assert.ok(src.includes('shouldSkipBannerAutoplay('), 'carrossel consulta movimento reduzido');
assert.ok(src.includes('document.hidden'), 'carrossel não troca slide com a aba oculta');
console.log('banner-autoplay.spec ok');
