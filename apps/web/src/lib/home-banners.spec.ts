import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BANNER_TAP_SLOP_PX,
  MAX_HOME_BANNERS,
  bannerAlt,
  bannerAriaLabel,
  bannerCreateCtaLabel,
  bannerCreatedToast,
  bannerCtaHref,
  bannerCtaLabel,
  bannerDotLabel,
  bannerImageIsPriority,
  bannerImageUrl,
  bannerNavNextLabel,
  bannerNavPrevLabel,
  bannerTapOpensLink,
  canCreateHomeBanner,
  clampBannerIndex,
  HOME_BANNER_ASPECT_DEFAULT,
  HOME_BANNER_ASPECT_DESKTOP,
  HOME_BANNER_ASPECT_MOBILE,
  homeBannerAspectCss,
  homeBannerCountHint,
  homeBannerFrameSize,
  homeBannerImageFit,
  homeBannerLimitMessage,
  homeBannerLoopSlides,
  homeBannerMinHeightFightsAspect,
  homeBannerRowCount,
  homeBannerSlideFrameLock,
  homeBannerSlideWidthLock,
  homeBannerSlotCounter,
  homeBannerTrackLength,
  isUsableHomeBanner,
  logicalFromTrackIndex,
  loopingAdvanceTrackIndex,
  loopingCloneJump,
  loopingTrackIndex,
  nextBannerIndex,
  shouldShowBannerChrome,
  takeUsableHomeBanners,
  trackIndexFromScroll,
  type HomeBanner,
} from './home-banners';

function banner(partial: Partial<HomeBanner> & Pick<HomeBanner, 'id' | 'imageUrl'>): HomeBanner {
  return {
    title: '',
    alt: '',
    linkUrl: null,
    sortOrder: 0,
    active: true,
    ...partial,
  };
}

assert.equal(MAX_HOME_BANNERS, 5);
assert.equal(canCreateHomeBanner(0), true);
assert.equal(canCreateHomeBanner(4), true);
assert.equal(canCreateHomeBanner(5), false);
assert.equal(canCreateHomeBanner(9), false);
assert.equal(canCreateHomeBanner(Number.NaN), true);

assert.equal(homeBannerRowCount(null), 0);
assert.equal(homeBannerRowCount([]), 0);
assert.equal(
  homeBannerRowCount([
    { active: true },
    { active: false },
    { active: true },
    { active: false },
    { active: false },
  ]),
  5,
  'inactive rows still count toward the create cap',
);
assert.equal(
  canCreateHomeBanner(
    homeBannerRowCount([{ active: false }, { active: false }, { active: false }, { active: false }]),
  ),
  true,
);
assert.equal(
  canCreateHomeBanner(
    homeBannerRowCount([
      { active: true },
      { active: false },
      { active: true },
      { active: false },
      { active: true },
    ]),
  ),
  false,
);

assert.equal(homeBannerSlotCounter(0), '0 de 5');
assert.equal(homeBannerSlotCounter(2), '2 de 5');
assert.equal(homeBannerSlotCounter(9), '5 de 5');
assert.equal(bannerCreateCtaLabel(0), 'Criar banner');
assert.equal(bannerCreateCtaLabel(1), 'Criar outro banner');
assert.equal(bannerCreateCtaLabel(4), 'Criar outro banner');
assert.equal(bannerCreatedToast(1), 'Banner criado. Pode adicionar mais (1/5).');
assert.equal(bannerCreatedToast(4), 'Banner criado. Pode adicionar mais (4/5).');
assert.ok(bannerCreatedToast(5).includes('Limite de 5'));

const six = Array.from({ length: 6 }, (_, i) =>
  banner({ id: `b${i}`, imageUrl: `https://cdn.example/b${i}.jpg`, sortOrder: i }),
);
assert.equal(takeUsableHomeBanners(six).length, 5);
assert.deepEqual(
  takeUsableHomeBanners(six).map((b) => b.id),
  ['b0', 'b1', 'b2', 'b3', 'b4'],
);

assert.equal(isUsableHomeBanner(banner({ id: 'ok', imageUrl: 'https://cdn.example/hero.jpg' })), true);
assert.equal(isUsableHomeBanner(banner({ id: 'empty', imageUrl: '   ' })), false);
assert.equal(isUsableHomeBanner(banner({ id: 'ph', imageUrl: 'https://placehold.co/1200x400' })), false);
assert.equal(isUsableHomeBanner(null), false);

assert.equal(takeUsableHomeBanners(null).length, 0);
assert.equal(
  takeUsableHomeBanners([
    banner({ id: 'ph', imageUrl: 'https://placehold.co/x' }),
    banner({ id: 'real', imageUrl: 'https://cdn.example/promo.jpg' }),
  ]).map((b) => b.id).join(),
  'real',
);

assert.equal(shouldShowBannerChrome(0), false);
assert.equal(shouldShowBannerChrome(1), false);
assert.equal(shouldShowBannerChrome(2), true);

assert.equal(nextBannerIndex(0, 3, 1), 1);
assert.equal(nextBannerIndex(2, 3, 1), 0);
assert.equal(nextBannerIndex(0, 3, -1), 2);
assert.equal(nextBannerIndex(0, 0, 1), 0);
assert.equal(clampBannerIndex(9, 3), 2);
assert.equal(clampBannerIndex(-1, 3), 0);

assert.equal(homeBannerTrackLength(0), 0);
assert.equal(homeBannerTrackLength(1), 1);
assert.equal(homeBannerTrackLength(4), 6, '4 real slides + 2 clones');
assert.equal(loopingTrackIndex(0, 4), 1);
assert.equal(loopingTrackIndex(3, 4), 4);
assert.equal(loopingAdvanceTrackIndex(3, 4, 1), 5, 'last → first is the trailing clone (one snap)');
assert.equal(loopingAdvanceTrackIndex(0, 4, -1), 0, 'first → last is the leading clone');
assert.equal(loopingAdvanceTrackIndex(1, 4, 1), 3);
assert.equal(loopingCloneJump(5, 4), 1);
assert.equal(loopingCloneJump(0, 4), 4);
assert.equal(loopingCloneJump(4, 4), null);
assert.equal(logicalFromTrackIndex(5, 4), 0);
assert.equal(logicalFromTrackIndex(0, 4), 3);
assert.equal(logicalFromTrackIndex(1, 4), 0);
assert.equal(trackIndexFromScroll(0, 390, 6), 0);
assert.equal(trackIndexFromScroll(390, 390, 6), 1);
assert.equal(trackIndexFromScroll(390 * 5, 390, 6), 5);

const loopFour = homeBannerLoopSlides([
  banner({ id: 'a', imageUrl: 'https://cdn.example/a.jpg' }),
  banner({ id: 'b', imageUrl: 'https://cdn.example/b.jpg' }),
  banner({ id: 'c', imageUrl: 'https://cdn.example/c.jpg' }),
  banner({ id: 'd', imageUrl: 'https://cdn.example/d.jpg' }),
]);
assert.equal(loopFour.length, 6);
assert.equal(loopFour[0].clone, true);
assert.equal(loopFour[0].item.id, 'd');
assert.equal(loopFour[1].clone, false);
assert.equal(loopFour[1].item.id, 'a');
assert.equal(loopFour[5].clone, true);
assert.equal(loopFour[5].item.id, 'a');
assert.equal(homeBannerLoopSlides([banner({ id: 'only', imageUrl: 'https://cdn.example/o.jpg' })]).length, 1);
assert.equal(bannerImageIsPriority(false, 0), true);
assert.equal(bannerImageIsPriority(true, 0), false, 'clone of first is not LCP');
assert.equal(bannerImageIsPriority(false, 1), false);

assert.equal(bannerCtaLabel(), 'Conferir agora');
assert.equal(bannerCtaHref({ linkUrl: '/departamento/ofertas' }), '/departamento/ofertas');
assert.equal(bannerCtaHref({ linkUrl: null }), '/departamento/ofertas');
assert.equal(bannerCtaHref({ linkUrl: '  ' }), '/departamento/ofertas');
assert.equal(bannerAlt({ alt: '', title: 'Semana do eletro' }), 'Semana do eletro');
assert.equal(bannerAriaLabel(0, 1), 'Destaques');
assert.equal(bannerAriaLabel(1, 3), 'Destaques (2 de 3)');
assert.equal(bannerNavPrevLabel(), 'Banner anterior');
assert.equal(bannerNavNextLabel(), 'Próximo banner');
assert.equal(bannerDotLabel(0), 'Banner 1');
assert.equal(homeBannerLimitMessage().includes('5'), true);
assert.ok(homeBannerCountHint(0).includes('5'));
assert.ok(homeBannerCountHint(2).startsWith('2 de 5'));
assert.ok(homeBannerCountHint(5).includes('Exclua'));

assert.equal(bannerTapOpensLink(0, 0), true);
assert.equal(bannerTapOpensLink(BANNER_TAP_SLOP_PX, 0), true);
assert.equal(bannerTapOpensLink(BANNER_TAP_SLOP_PX + 1, 0), false);

assert.deepEqual(homeBannerSlideWidthLock(), [
  'flex: 0 0 100%',
  'width: 100%',
  'min-width: 100%',
  'max-width: 100%',
]);
assert.deepEqual(homeBannerSlideFrameLock(), [
  'flex: 0 0 100%',
  'width: 100%',
  'min-width: 100%',
  'max-width: 100%',
  'height: 100%',
  'min-height: 0',
  'max-height: 100%',
]);
assert.equal(homeBannerImageFit(), 'object-fit: cover');
assert.equal(homeBannerAspectCss(HOME_BANNER_ASPECT_MOBILE), '16 / 10');
assert.equal(homeBannerAspectCss(HOME_BANNER_ASPECT_DESKTOP), '21 / 7');
assert.equal(homeBannerAspectCss(HOME_BANNER_ASPECT_DEFAULT), '21 / 8');
assert.deepEqual(homeBannerFrameSize(390, HOME_BANNER_ASPECT_MOBILE), { width: 390, height: 243.75 });
assert.deepEqual(homeBannerFrameSize(1280, HOME_BANNER_ASPECT_DESKTOP), { width: 1280, height: 1280 * 7 / 21 });
assert.equal(homeBannerMinHeightFightsAspect(390, 160, HOME_BANNER_ASPECT_MOBILE), false);
assert.equal(
  homeBannerMinHeightFightsAspect(300, 168, HOME_BANNER_ASPECT_DEFAULT),
  true,
  'min-height 168px on a 300px-wide 21/8 strip would fight the frame',
);

const css = readFileSync(join(__dirname, '../app/globals.css'), 'utf8');
assert.ok(/html, body[\s\S]{0,180}overflow-x:\s*hidden/.test(css), 'document must not scroll sideways');
assert.ok(/\.home\s*\{[^}]*overflow-x:\s*hidden/.test(css), 'home page hides horizontal overflow');
assert.ok(/\.home-banners\s*\{[^}]*overflow-x:\s*hidden/.test(css), 'banner shell does not leak sideways');
assert.ok(/\.home-banner-track[\s\S]{0,420}scroll-snap-type:\s*x mandatory/.test(css), 'home swipe is internal scroll-snap');
assert.ok(/\.home-banner-track[\s\S]{0,420}overflow-x:\s*auto/.test(css), 'only the banner track scrolls horizontally');
assert.ok(/\.home-banner-slide\s*\{[^}]*min-width:\s*100%/.test(css), 'slides lock to track width');
assert.ok(/\.home-banner-slide\s*\{[^}]*height:\s*100%/.test(css), 'slides fill the shared frame height');
assert.ok(/\.home-banner-slide\s*\{[^}]*min-height:\s*0/.test(css), 'img intrinsic size cannot grow the flex item');
assert.ok(/\.home-banners\s*\{[^}]*--home-banner-aspect:\s*21\s*\/\s*8/.test(css), 'one aspect token for every slide');
assert.ok(
  /\.home-banners-viewport[\s\S]{0,280}aspect-ratio:\s*var\(--home-banner-aspect\)/.test(css),
  'viewport is the fixed Magalu strip; images cannot resize it',
);
assert.ok(/\.home-banner-img[\s\S]{0,420}object-fit:\s*cover/.test(css), 'photos crop inside the frame');
assert.ok(/\.home-banner-img[\s\S]{0,220}position:\s*absolute/.test(css), 'img is taken out of flow so PNG ratio cannot stretch the slide');
assert.equal(
  /\.home-banner-slide[^}]*min-height:\s*(160|168|240)px/.test(css),
  false,
  'must not set a min-height that fights aspect-ratio (PDP gallery lesson)',
);
assert.ok(/\.home-banner-slide\s*\{[^}]*scroll-snap-stop:\s*normal/.test(css), 'soft snap — reverse fling is not locked');
assert.equal(
  /\.home-banner-track\s*\{[^}]*scroll-behavior:\s*smooth/.test(css),
  false,
  'no CSS smooth on the track (native momentum on mobile)',
);
assert.ok(/\.home-banner-track[\s\S]{0,480}overscroll-behavior-x:\s*contain/.test(css), 'overscroll stays inside the track');
assert.ok(/\.home-banner-img[\s\S]{0,480}content-visibility:\s*auto/.test(css), 'off-screen banner bitmaps skip paint');
assert.ok(/\.home-banner-dots[\s\S]{0,120}position:\s*static/.test(css), 'dots sit under the banner');
assert.ok(/@media \(max-width: 720px\)[\s\S]*\.home-banners\s*\{[^}]*--home-banner-aspect:\s*16\s*\/\s*10/.test(css), 'mobile uses one 16/10 frame');
assert.ok(/@media \(min-width: 721px\)[\s\S]*\.home-banners\s*\{[^}]*--home-banner-aspect:\s*21\s*\/\s*7/.test(css), 'desktop uses one 21/7 frame');
assert.ok(
  /@media \(max-width: 720px\)[\s\S]*\.home-banner-nav[\s\S]*display:\s*none/.test(css),
  'mobile uses swipe + dots, not side arrows',
);

const src = readFileSync(join(__dirname, '../components/HomeBanners.tsx'), 'utf8');
assert.ok(src.includes('home-banner-track'), 'carousel renders a swipe track');
assert.ok(src.includes('takeUsableHomeBanners'), 'storefront caps usable banners at 5');
assert.ok(src.includes('shouldShowBannerChrome'), 'single banner hides arrows/dots');
assert.ok(src.includes('StaticPromoStrip'), 'empty API keeps the current promo as slide 1');
assert.ok(src.includes('pauseAuto'), 'auto-advance pauses on touch');
assert.ok(src.includes('HOME_BANNER_AUTO_MS'), 'gentle auto-advance is wired');
assert.ok(src.includes('homeBannerLoopSlides'), '2+ banners render wrap clones');
assert.ok(src.includes('loopingAdvanceTrackIndex'), 'last→first advances one snap via clone');
assert.ok(src.includes('loopingCloneJump'), 'clone snap jumps to the real slide');
assert.ok(src.includes('interacting.current'), 'finger down pauses programmatic scroll');
assert.ok(src.includes('if (!el || interacting.current) return'), 'scrollTo does not run during touch');
assert.ok(src.includes('settleLoopRef'), 'clone jump after wrap uses the latest settle fn');
assert.ok(src.includes('bannerImageIsPriority'), 'eager/high only on the first real slide');
assert.ok(src.includes('onDragStart'), 'banner drag ghost must not overlay the track');
assert.equal(src.includes('onTouchStart'), false, 'JS swipe must not fight native scroll-snap');
assert.equal(src.includes('scrollSyncLock'), false, 'must not lock scrollLeft updates for 350ms');
assert.ok(src.includes('bannerCtaLabel()'), 'CTA copy stays Conferir agora');

const libSrc = readFileSync(join(__dirname, './home-banners.ts'), 'utf8');
assert.ok(libSrc.includes('localizeStorefrontUploadUrl'), 'localhost loads banner PNGs same-origin');

const adminSrc = readFileSync(
  join(__dirname, '../components/admin/sections/AdminVitrineSection.tsx'),
  'utf8',
);
assert.ok(adminSrc.includes('homeBannerCountHint'), 'admin shows 1–5 slot hint');
assert.ok(adminSrc.includes('canCreateHomeBanner'), 'admin hides create at the 5-banner cap');
assert.ok(adminSrc.includes('homeBannerSlotCounter'), 'admin shows N de 5 counter');
assert.ok(adminSrc.includes('bannerCreateCtaLabel'), 'create CTA becomes Criar outro banner');
assert.ok(adminSrc.includes('AdminPhotoFilePicker'), 'vitrine uses mobile-safe picker');
assert.ok(adminSrc.includes('multiple={false}'), 'banner picker is single-file');
assert.ok(!/style=\{\{\s*display:\s*'none'\s*\}\}/.test(adminSrc), 'banner file input must not be display:none');
assert.ok(!adminSrc.includes('admin-file-hidden'), 'vitrine must not clip/1px hide file inputs');
assert.ok(adminSrc.includes('role="alert"'), 'banner errors are loud on the vitrine block');
assert.ok(adminSrc.includes('admin-photo-feedback'), 'banner errors stick on the form');
assert.ok(adminSrc.includes('Criar outro banner'), 'owner can start another banner after create');
assert.ok(adminSrc.includes('homeBannerRowCount'), 'create limit counts total rows');

const adminState = readFileSync(join(__dirname, '../components/admin/admin-console-state.ts'), 'utf8');
assert.ok(adminState.includes('homeBannerLimitMessage'), 'create is blocked at 5 on the client');
assert.ok(adminState.includes('snapshotSelectedFiles'), 'banner upload copies FileList before clear');
assert.ok(adminState.includes('emptyPhotoSelectionError'), 'empty banner pick is loud');
assert.ok(adminState.includes('bannerCreatedToast'), 'create toast invites another banner');
assert.ok(adminState.includes('homeBannerRowCount'), 'client create cap uses total rows');

assert.equal(bannerImageUrl({ imageUrl: '  https://cdn.example/a.jpg  ' }), 'https://cdn.example/a.jpg');

console.log('home-banners unit tests ok');
