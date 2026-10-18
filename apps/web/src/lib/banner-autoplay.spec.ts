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
// Perf (WebView): autoplay só com o banner na tela; dedo no banner não causa render do React.
assert.ok(src.includes('new IntersectionObserver('), 'autoplay pausa com o banner fora da tela');
assert.ok(src.includes('pausedUntil.current'), 'pausa por toque fica num ref, sem setState');
assert.equal(src.includes('setPaused('), false, 'finger-down não dispara commit do React');
assert.ok(/const BannerSlides = memo\(/.test(src), 'slides memoizados: troca de slide não re-renderiza 9 imagens');
const css = readFileSync(join(__dirname, '../app/globals.css'), 'utf8');
const dot = /\.home-banner-dot::before\s*\{[^}]*\}/.exec(css)?.[0] ?? '';
assert.equal(/transition:[^;]*width/.test(dot), false, 'ponto ativo não anima width (layout+paint por frame)');
console.log('banner-autoplay.spec ok');
