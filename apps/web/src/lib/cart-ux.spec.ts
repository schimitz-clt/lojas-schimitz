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
assert.ok(
  /\.cart-sticky-checkout\s*\{[^}]*position:\s*static/.test(mobileCss),
  'cart checkout stays in normal flow on mobile',
);
assert.equal(
  /\.cart-sticky-checkout[\s\S]{0,280}position:\s*fixed/.test(mobileCss),
  false,
  'cart checkout is not fixed above the bottom nav',
);
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
