import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HOME_CATALOG_LOAD_ERROR, deliveryAddressHref, deliveryBarCopy, homeQuickShortcuts } from './home-ux';

{
  const guest = homeQuickShortcuts(null);
  assert.deepEqual(
    guest.map((s) => s.label),
    ['Cupons', 'Ofertas', 'Categorias'],
  );
  assert.equal(guest[0].href, '/carrinho#cart-coupon');
  assert.equal(guest[1].href, '/departamento/ofertas');
  assert.equal(guest[2].href, '/produtos');
  assert.equal(homeQuickShortcuts('customer')[0].href, '/carrinho#cart-coupon');
  assert.equal(homeQuickShortcuts('admin')[0].href, '/admin/cupons');
  assert.ok(guest.every((s) => s.description.length > 3));
}

{
  const saved = deliveryBarCopy({
    addresses: [
      {
        id: 'a2',
        street: 'Rua B',
        number: '2',
        city: 'Canoas',
        cep: '92000000',
        isDefault: false,
      },
      {
        id: 'a1',
        street: 'Avenida Major Manoel Jose Monteiro',
        number: '100',
        city: 'Porto Alegre',
        cep: '91160390',
        isDefault: true,
      },
    ],
    storedCep: '90010-000',
  });
  assert.equal(saved.mode, 'address');
  assert.equal(saved.title, 'Avenida Major Manoel Jose Monteiro, 100 · Porto Alegre');
  assert.equal(saved.detail, 'CEP 91160-390');
  assert.equal(saved.cep, '91160-390');
  assert.equal(saved.accountHref, '/conta/dados#enderecos');

  const cepOnly = deliveryBarCopy({ addresses: [], storedCep: '91160-390' });
  assert.equal(cepOnly.mode, 'cep');
  assert.equal(cepOnly.title, 'Entrega para 91160-390');
  assert.equal(cepOnly.accountHref, null);

  const fromAddressCep = deliveryBarCopy({
    addresses: [{ id: 'x', cep: '91160390', isDefault: true }],
    storedCep: '90010000',
  });
  assert.equal(fromAddressCep.mode, 'cep');
  assert.equal(fromAddressCep.cep, '91160-390');

  const empty = deliveryBarCopy({ addresses: null, storedCep: '911' });
  assert.equal(empty.mode, 'prompt');
  assert.equal(empty.title, 'Informar CEP');
  assert.equal(empty.cep, '');

  const cityOnly = deliveryBarCopy({
    addresses: [{ id: 'c', city: 'Porto Alegre', cep: '91160390' }],
    storedCep: '',
  });
  assert.equal(cityOnly.mode, 'address');
  assert.equal(cityOnly.title, 'Porto Alegre');
}

assert.equal(deliveryAddressHref(true), '/conta/dados#enderecos');
assert.equal(deliveryAddressHref(false), '/entrar?next=%2Fconta%2Fdados%23enderecos');

const srcRoot = join(__dirname, '..');
const page = readFileSync(join(srcRoot, 'app/page.tsx'), 'utf8');
assert.ok(page.includes('HomeShortcuts'), 'home adds shortcut row');
assert.ok(page.includes('HomeShelves'), 'shelves stay');
assert.ok(page.includes('HomeBanners'), 'hero stays');
assert.ok(page.includes('Categorias'), 'category section stays');
assert.ok(page.includes('variant="shelf"'), 'home search cards use shelf density');
assert.equal(HOME_CATALOG_LOAD_ERROR, 'Não foi possível carregar os produtos agora.');
assert.ok(page.includes('HOME_CATALOG_LOAD_ERROR'), 'home shows the customer catalog error');
assert.equal(page.includes('Suba a API e rode o seed'), false, 'home does not tell shoppers to seed');

const shelves = readFileSync(join(srcRoot, 'components/HomeShelves.tsx'), 'utf8');
assert.ok(shelves.includes('variant="shelf"'), 'shelf rails keep ProductCard, tighter variant');
assert.ok(shelves.includes('ProductCard'), 'rails still reuse ProductCard');

const header = readFileSync(join(srcRoot, 'components/Header.tsx'), 'utf8');
assert.ok(header.includes('HomeDeliveryBar'), 'CEP row under the search');
assert.ok(header.includes('site-chrome-head'), 'sticky search chrome');
assert.equal(header.includes('is-compact'), false, 'no scroll-driven compact class (avoids sticky height jitter)');
assert.equal(header.includes('setCompact'), false, 'no scroll listener toggling chrome height');
assert.ok(header.includes('/me/addresses'), 'logged-in bar uses saved addresses');
assert.ok(header.includes('STOREFRONT_CEP_KEY') || header.includes('readStoredCep'), 'reuses sch_cep');
assert.ok(header.includes('<SearchBox'), 'search suggestions stay');
assert.ok(header.includes('hdr-hide-sm'), 'account stays off the mobile header');
assert.ok(header.includes('hdr-search-back'), 'search results chrome has back');
assert.ok(header.includes('is-search-results'), 'results mode marks sticky chrome');
assert.ok(header.includes('useSearchParams'), 'results mode tracks URL q across client nav');
assert.ok(header.includes('usePathname'), 'results mode tracks /produtos path');

const chrome = readFileSync(join(srcRoot, 'components/StorefrontChrome.tsx'), 'utf8');
assert.ok(chrome.includes('Suspense'), 'Header with useSearchParams is Suspense-wrapped');

const bar = readFileSync(join(srcRoot, 'components/HomeDeliveryBar.tsx'), 'utf8');
assert.ok(bar.includes('Informar CEP'), 'empty state asks for CEP');
assert.ok(bar.includes('data-cep-input'), 'reuses the CEP field');
assert.ok(!/viacep/i.test(bar), 'does not invent a street lookup');

const card = readFileSync(join(srcRoot, 'components/ProductCard.tsx'), 'utf8');
assert.ok(card.includes('Adicionar à sacola') || card.includes('productCardAddLabel'), 'bag CTA');
assert.ok(card.includes('pixPrice'), 'PIX 5% stays');
assert.ok(card.includes('FavoriteToggle'), 'heart stays');
assert.ok(card.includes('/cart/items'), 'reuses cart add');
assert.ok(card.includes('pcard-shelf'), 'shelf density class');

const shortcuts = readFileSync(join(srcRoot, 'components/HomeShortcuts.tsx'), 'utf8');
const css = readFileSync(join(srcRoot, 'app/globals.css'), 'utf8');
assert.ok(css.includes('overflow-x: clip'), 'sticky search is not broken by overflow-x hidden');
assert.ok(css.includes('.delivery-bar'), 'location row styled');
assert.ok(css.includes('.home-shortcuts'), 'shortcut circles styled');
assert.ok(/\.cat-strip\s*\{[^}]*overflow-y:\s*hidden/.test(css), 'category row is not a vertical scrollport');
assert.equal(
  /\.cat-strip\s*\{[^}]*scroll-behavior:\s*smooth/.test(css),
  false,
  'category row keeps native momentum',
);
assert.ok(/\.cat-strip\s*\{[^}]*touch-action:\s*pan-x pan-y/.test(css), 'category row allows vertical page scroll');
assert.ok(/\.cat-strip\s*\{[^}]*scroll-snap-type:\s*none/.test(css), 'category row does not snap against the finger');
assert.ok(/\.main-shell\s*\{[^}]*overflow-x:\s*clip/.test(css), 'home scroll stays on the document');
assert.ok(/\.cat-strip\s*\{[^}]*align-items:\s*flex-start/.test(css), 'category circles share one top edge');
assert.equal(
  /\.cat-chip-label\s*\{[^}]*hyphens:\s*auto/.test(css),
  false,
  'category labels are not hyphenated mid-word',
);
assert.ok(/\.cat-chip-label\s*\{[^}]*hyphens:\s*none/.test(css), 'category labels opt out of hyphenation');
assert.ok(
  /@media \(max-width: 720px\)[\s\S]*\.cat-chip-label\s*\{[^}]*min-height:\s*2\.6em/.test(css),
  'mobile labels reserve two lines so wrapped text stays on the same band',
);
assert.ok(page.includes('categoryChipLabelLines'), 'long category names break on a word boundary');
assert.ok(page.includes('cat-chip-label-break'), 'the mobile line break can be hidden on desktop');
assert.equal(
  /\.home-shelf-rail\s*\{[^}]*scroll-behavior:\s*smooth/.test(css),
  false,
  'home shelves keep native momentum',
);
assert.ok(/\.home-shelf-rail\s*\{[^}]*touch-action:\s*pan-x pan-y/.test(css), 'shelf rails do not trap vertical scroll');
assert.ok(/\.home-shelf-rail > \.pcard\s*\{[^}]*scroll-snap-stop:\s*normal/.test(css), 'shelf fling is not stopped on every card');
assert.equal(
  /\.cat-chip-ico\s*\{[^}]*transition:\s*box-shadow/.test(css),
  false,
  'category circles do not animate box-shadow during touch scroll',
);
assert.ok(page.includes('fetchPriority="low"'), 'category photos do not compete with the banner');
assert.ok(page.includes("loading={i < 4 ? 'eager' : 'lazy'}"), 'only on-screen circles decode up front');
const theme = readFileSync(join(srcRoot, 'components/storefront/storefront-theme.css'), 'utf8');
assert.equal(
  /\.cat-chip-ico\s*\{[^}]*transition:\s*box-shadow/.test(theme),
  false,
  'theme does not reintroduce box-shadow animation on category circles',
);
assert.ok(css.includes('.pcard-shelf'), 'tighter shelf cards');
assert.ok(css.includes('.bottom-nav-ico svg'), 'bottom nav SVGs are optically sized');
assert.ok(shortcuts.includes('HomeShortcutGlyph'), 'home shortcuts share the storefront icon set');
assert.equal(css.includes('.site-chrome-head.is-compact'), false, 'compact collapse CSS removed');
assert.ok(
  /\.site-chrome-head\s*\{[^}]*position:\s*sticky/s.test(css),
  'sticky lives on site-chrome-head (tall enough track vs viewport siblings)',
);
assert.ok(header.includes('topbar') && header.includes('site-chrome-head'), 'topbar and chrome stay');
assert.ok(
  header.indexOf('topbar') < header.indexOf('site-chrome-head'),
  'topbar is outside the sticky wrapper so it can scroll away without height thrash',
);
assert.ok(!/magalu/i.test(bar + shortcuts), 'new home UI has no Magalu trademark');

console.log('home-ux unit tests ok');
