import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Top promo strip only — do not advertise atendimento WhatsApp there. */
const header = readFileSync(join(__dirname, '..', 'components/Header.tsx'), 'utf8');
const topbar = header.match(/className="topbar"[\s\S]*?<\/div>/);
assert.ok(topbar, 'header topbar exists');
assert.ok(!/atendimento\s+whatsapp/i.test(topbar[0]), 'topbar must not say Atendimento WhatsApp');
assert.ok(!/whatsapp/i.test(topbar[0]), 'topbar must not mention WhatsApp');
assert.ok(/Frete grátis em POA/.test(topbar[0]), 'topbar keeps frete');
assert.ok(/PIX/.test(topbar[0]), 'topbar keeps PIX');
assert.ok(header.includes('interestFreeInstallmentClaim()'), 'topbar keeps 3x claim helper');
assert.ok(/className="btn wa[\w\s-]*"/.test(header), 'header WhatsApp contact button remains');
assert.ok(header.includes('<SearchBox'), 'header search uses live suggestions box');
assert.ok(!/Atendimento WhatsApp/.test(header), 'header file must not add Atendimento WhatsApp copy');

const accountLink = header.match(
  /<Link className="hdr-link[^"]*" href=\{user \? '\/conta' : '\/entrar'\}(?: prefetch=\{true\})?>/,
);
assert.ok(accountLink, 'header account link (Claiton / Entrar) exists');
assert.ok(
  accountLink[0].includes('hdr-hide-sm'),
  'header account is hidden on mobile; bottom Conta is the single entry',
);

const cartLink = header.match(/<Link className="hdr-link[^"]*" href="\/carrinho"(?: prefetch=\{true\})?>/);
assert.ok(cartLink, 'header cart link exists');
assert.ok(
  !cartLink[0].includes('hdr-hide-sm'),
  'header cart stays visible on mobile (owner only asked about Conta)',
);

const bottomNav = readFileSync(join(__dirname, '..', 'components/BottomNav.tsx'), 'utf8');
assert.ok(/label: 'Início'/.test(bottomNav), 'bottom tab Início');
assert.ok(/label: 'Buscar'/.test(bottomNav), 'catalog tab uses the short Buscar label');
assert.ok(!/label: 'Departamentos'/.test(bottomNav), 'catalog tab uses a short label');
assert.ok(/href: '\/produtos'/.test(bottomNav), 'Buscar opens the existing catalog');
assert.ok(/label: 'Sacola'/.test(bottomNav), 'cart tab is Sacola');
assert.ok(/href: '\/carrinho'/.test(bottomNav), 'Sacola keeps the cart route');
assert.ok(/label: 'Favoritos'/.test(bottomNav), 'wishlist tab is Favoritos');
assert.ok(/href: '\/conta\/salvos'/.test(bottomNav), 'Favoritos keeps the salvos route');
assert.ok(/label: 'Conta'/.test(bottomNav), 'bottom tab bar keeps Conta');
assert.ok(/contaHref/.test(bottomNav), 'bottom Conta still uses contaHref');
assert.ok(/contaHref = '\/conta'/.test(bottomNav), 'bottom Conta always opens the /conta hub');
assert.ok(/sch-cart-updated/.test(bottomNav), 'Sacola badge still listens for cart updates');

const idCss = readFileSync(join(__dirname, '..', 'components/storefront/identidade.css'), 'utf8');
const idMobile = idCss.slice(idCss.indexOf('@media (max-width: 720px)'));
assert.ok(idMobile.startsWith('@media (max-width: 720px)'), 'identidade mobile block');
assert.ok(
  /\.bottom-nav\s*\{[^}]*background:\s*#07122a/.test(idMobile),
  'tab bar is solid navy',
);
assert.ok(
  /\.bottom-nav\s*\{[^}]*border-radius:\s*0/.test(idMobile),
  'tab bar is flat and edge-to-edge',
);
assert.ok(
  /\.bottom-nav\s*\{[^}]*padding-bottom:\s*env\(safe-area-inset-bottom/.test(idMobile),
  'tab bar pads the safe area',
);
assert.ok(
  !/\.bottom-nav-dock\s*\{[^}]*border-radius:\s*28px/.test(idCss),
  'nav row is not a floating pill',
);
assert.ok(
  /\.bottom-nav-label\s*\{[^}]*position:\s*static/.test(idMobile),
  'every tab shows its label under the icon',
);
assert.ok(
  !/\.bottom-nav-item:not\(\.active\) \.bottom-nav-label/.test(idMobile),
  'inactive labels stay visible',
);
assert.ok(
  /\.chatw-fab\s*\{[^}]*display:\s*none/.test(idMobile),
  'mobile AI control is not a floating circle',
);
assert.ok(
  /\.main-shell\s*\{[^}]*padding-bottom:\s*calc\(var\(--tab-bar-h\) \+ env\(safe-area-inset-bottom/.test(idMobile),
  'page content clears the tab bar and safe area',
);
assert.ok(
  /\.id-pdp \.pdp-buybar\s*\{[^}]*bottom:\s*calc\(var\(--tab-bar-h\) \+ env\(safe-area-inset-bottom/.test(idMobile),
  'product buy bar sits on top of the tab bar',
);
assert.ok(/--tab-bar-h:\s*64px/.test(idCss), 'tab bar content is 64px before the safe area');
assert.ok(
  /\.bottom-nav-item\s*\{[^}]*min-height:\s*var\(--tab-bar-h\)/.test(idMobile),
  'each tab touch target fills the bar',
);
assert.ok(/\.bottom-nav-label\s*\{[^}]*font-size:\s*12px/.test(idMobile), 'tab labels are 12px');
assert.ok(/\.bottom-nav-ico\s*\{[^}]*width:\s*28px/.test(idMobile), 'tab icons are 28px');

console.log('storefront-copy unit tests ok');
