import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pixPrice } from './pricing';
import { cartEmptyCopy, cartFreightNote, cartLinePriceView } from './cart-ux';

{
  const view = cartLinePriceView(100, 2, 200);
  assert.equal(view.list, 200);
  assert.equal(view.pix, pixPrice(200));
  assert.equal(view.pix, 190);
  assert.equal(view.tag, '5% OFF');
  assert.equal(view.pixSuffix, 'no PIX');
  assert.ok(view.orList?.startsWith('ou '));
  assert.ok(view.orList?.includes('200'));
  assert.ok(view.install?.includes('sem juros'));
  assert.ok(view.unitHint?.includes('cada'));
  assert.ok(view.unitHint?.includes('2'));
}

{
  const one = cartLinePriceView(89.9, 1, 89.9);
  assert.equal(one.pix, pixPrice(89.9));
  assert.equal(one.unitHint, null);
  assert.equal(one.tag, '5% OFF');
}

{
  const skipped = cartLinePriceView(100, 1, 100, { skipPixPromo: true });
  assert.equal(skipped.pix, null);
  assert.equal(skipped.tag, null);
  assert.equal(skipped.orList, null);
  assert.ok(skipped.install?.includes('sem juros'));
}

{
  const emptyPrice = cartLinePriceView(0, 1, 0);
  assert.equal(emptyPrice.pix, null);
  assert.equal(emptyPrice.install, null);
  assert.equal(emptyPrice.list, 0);
}

const empty = cartEmptyCopy();
assert.equal(empty.homeHref, '/');
assert.equal(empty.catalogHref, '/produtos');
assert.ok(empty.title.includes('vazia'));
assert.ok(empty.homeLabel.length > 3);
assert.ok(empty.catalogLabel.length > 3);

const freight = cartFreightNote();
assert.ok(/CEP/i.test(freight.title + freight.body));
assert.ok(/entrega própria/i.test(freight.body));
assert.ok(/PIX/i.test(freight.pay));
assert.ok(!/melhor\s*envio/i.test(`${freight.title} ${freight.body} ${freight.pay}`));

const root = join(__dirname, '..');
const cart = readFileSync(join(root, 'app/carrinho/page.tsx'), 'utf8');
assert.ok(cart.includes('cartLinePriceView'), 'lines use the shared PIX view');
assert.ok(cart.includes('cartEmptyCopy'), 'empty state uses the helper');
assert.ok(cart.includes('cartFreightNote'), 'freight note uses the helper');
assert.ok(cart.includes('emptyCopy.homeHref'), 'empty sacola links home');
assert.ok(cart.includes('emptyCopy.catalogHref'), 'empty sacola links to produtos');
assert.ok(!/melhor\s*envio/i.test(cart), 'cart does not invent Melhor Envio');

const summaryAt = cart.indexOf('className="cart-summary');
const stickyAt = cart.indexOf('className="cart-sticky-checkout"');
assert.ok(summaryAt > 0 && stickyAt > summaryAt);
assert.equal(cart.slice(summaryAt, stickyAt).includes('cart-checkout-btn'), false);
assert.equal((cart.match(/cart-checkout-btn/g) || []).length, 2, 'single sticky checkout CTA');
assert.ok(/mixedCart \? \(/.test(cart), 'mixed cart still branches the CTA');
assert.ok(
  /<button className="btn cart-checkout-btn" type="button" disabled>/.test(cart),
  'mixed cart keeps Finalizar disabled',
);

const css = readFileSync(join(root, 'components/storefront/storefront-theme.css'), 'utf8');
assert.ok(css.includes('cart-sticky-desktop'), 'desktop still shows the one sticky Finalizar');
assert.ok(css.includes('.cart-empty'), 'empty sacola is styled');
assert.ok(css.includes('.cart-freight'), 'freight block is styled');
assert.ok(css.includes('.cart-line-pix'), 'line PIX price is styled');

const globals = readFileSync(join(root, 'app/globals.css'), 'utf8');
const mobileCss = globals.slice(
  globals.indexOf('@media (max-width: 720px)'),
  globals.indexOf('@media (max-width: 520px)'),
);
// Owner decision 27/09 18:06 (Improvement 6, fix 1) replaces the 22/09 rule "CTAs rolam" (ad6cfd6):
// on mobile the cart total + checkout CTA is pinned right above the fixed full-width bottom nav,
// the same navy bar as the PDP buy bar. globals.css keeps the base (static) block; the pin lives in
// identidade.css (loaded last), scoped to `.cart-page` and to the ≤720px block.
assert.ok(
  /\.cart-sticky-checkout\s*\{[^}]*position:\s*static/.test(mobileCss),
  'globals base block unchanged (identidade.css pins it on mobile)',
);
const idCss = readFileSync(join(root, 'components/storefront/identidade.css'), 'utf8');
const idMobile = idCss.slice(idCss.indexOf('@media (max-width: 720px)'));
const pinned = /\.cart-page \.cart-sticky-checkout\s*\{([^}]*)\}/.exec(idMobile);
assert.ok(pinned, 'cart checkout bar has a mobile pin rule');
assert.ok(/position:\s*fixed/.test(pinned![1]), 'cart checkout pinned on mobile');
assert.ok(/left:\s*0;[\s\S]*right:\s*0;/.test(pinned![1]), 'full-width bar, not floating');
assert.ok(
  /bottom:\s*calc\(var\(--tab-bar-h\) \+ env\(safe-area-inset-bottom, 0px\)\)/.test(pinned![1]),
  'sits right above the bottom nav (same offset as the PDP buy bar)',
);
assert.ok(/border-radius:\s*0/.test(pinned![1]), 'square full-width bar like the PDP buy bar');
assert.ok(/var\(--id-cream\)/.test(pinned![1]), 'navy bar with cream text (owner palette)');
assert.ok(
  /body:has\(\.cart-page \.cart-sticky-checkout\) \.footer\s*\{[^}]*padding-bottom:\s*calc\(var\(--tab-bar-h\)/.test(idMobile),
  'footer end clears both the bottom nav and the pinned bar on the cart',
);
const pinAt = idCss.indexOf('.cart-page .cart-sticky-checkout {');
const enclosingMedia = idCss.slice(0, pinAt).match(/@media[^{]*\{/g)?.pop() || '';
assert.ok(enclosingMedia.includes('max-width: 720px'), 'pin only inside the ≤720px block (desktop untouched)');
assert.equal((idCss.match(/\.cart-page \.cart-sticky-checkout \{/g) || []).length, 1, 'single pin rule');
assert.equal(
  /padding-bottom:\s*calc\(110px/.test(mobileCss),
  false,
  'cart page does not reserve space for a fixed checkout bar',
);
assert.ok(
  /\.bottom-nav\s*\{[^}]*position:\s*fixed/.test(mobileCss),
  'bottom nav stays fixed while checkout scrolls',
);
assert.ok(
  /\.bottom-nav\s*\{[^}]*left:\s*0[^}]*right:\s*0[^}]*bottom:\s*0/.test(mobileCss),
  'checkout scroll still uses the full-width docked bar',
);

const chrome = readFileSync(join(root, 'components/StorefrontChrome.tsx'), 'utf8');
assert.ok(chrome.includes('<BottomNav />'), 'bottom nav is storefront chrome, not a per-page bar');
assert.equal((chrome.match(/<BottomNav \/>/g) || []).length, 1, 'one bottom nav for every storefront route');
assert.ok(chrome.includes("path.startsWith('/admin/')"), 'admin is the only chrome opt-out');

const checkout = readFileSync(join(root, 'app/checkout/page.tsx'), 'utf8');
const cartPage = readFileSync(join(root, 'app/carrinho/page.tsx'), 'utf8');
const payment = readFileSync(join(root, 'app/pedidos/[publicId]/page.tsx'), 'utf8');
assert.ok(!checkout.includes('bottom-nav'), 'checkout does not hide or replace the chrome nav');
assert.ok(!cartPage.includes('bottom-nav'), 'cart does not hide or replace the chrome nav');
assert.ok(!payment.includes('bottom-nav'), 'payment step does not hide or replace the chrome nav');
assert.ok(payment.includes('MercadoPagoCardBrick'), 'card payment stays an inline Brick on the order page');

console.log('cart-ux unit + source tests ok');
