import assert from 'node:assert/strict';
import {
  cartCheckoutLabel,
  cartTrustItems,
  discountPercent,
  pixHighlight,
  stickyBuyLabel,
} from './storefront-pro';

assert.equal(discountPercent(100, 200), 50);
assert.equal(discountPercent(100, 100), null);
assert.equal(discountPercent(100, 80), null);
assert.equal(discountPercent(0, 100), null);
assert.equal(discountPercent('90', '100'), 10);

const h = pixHighlight(100);
assert.equal(h.list, 100);
assert.equal(h.pix, 95);
assert.equal(h.savings, 5);
assert.equal(h.tag, '5% OFF');
assert.ok(h.savingsLine.includes('Economize'));
assert.ok(h.savingsLine.includes('PIX'));

const trust = cartTrustItems();
assert.equal(trust.length, 3);
assert.ok(trust.every((t) => t.title && t.sub));
assert.ok(trust.some((t) => /PIX/i.test(t.title)));

assert.equal(stickyBuyLabel({ outOfStock: true, adding: false, addedToBag: false }), 'Indisponível');
assert.equal(stickyBuyLabel({ outOfStock: false, adding: true, addedToBag: false }), 'Adicionando...');
assert.equal(
  stickyBuyLabel({ outOfStock: false, adding: false, addedToBag: true }),
  'Ir para a sacola',
);
assert.equal(
  stickyBuyLabel({ outOfStock: false, adding: false, addedToBag: false }),
  'Adicionar à sacola',
);

assert.equal(cartCheckoutLabel(true), 'Finalizar compra');
assert.equal(cartCheckoutLabel(false), 'Entrar e finalizar');

console.log('storefront-pro unit tests ok');
