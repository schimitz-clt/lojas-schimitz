import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MARKETPLACE_MIXED_CART_CODE,
  MARKETPLACE_MIXED_CART_MESSAGE_PT,
  isMixedSellerCart,
  mixedCartBlockMessagePt,
  mixedCartSellerNames,
  uniqueCartSellerIds,
} from './mixed-cart';

const house = { sellerId: '1', seller: { id: '1', name: 'Lojas Schimitz', slug: 'lojas-schimitz' } };
const partner = { sellerId: '2', seller: { id: '2', name: 'Parceiro', slug: 'parceiro' } };

assert.deepEqual(uniqueCartSellerIds([house, house]), ['1']);
assert.equal(isMixedSellerCart([house, house]), false);
assert.equal(isMixedSellerCart([house, partner]), true);
assert.equal(isMixedSellerCart([house], true), true);
assert.deepEqual(mixedCartSellerNames([house, partner]), ['Lojas Schimitz', 'Parceiro']);
assert.ok(MARKETPLACE_MIXED_CART_MESSAGE_PT.includes('único vendedor'));
assert.equal(MARKETPLACE_MIXED_CART_CODE, 'MARKETPLACE_MIXED_CART');
assert.ok(mixedCartBlockMessagePt([house, partner]).includes('Lojas Schimitz'));
assert.ok(mixedCartBlockMessagePt([house, partner]).includes('Parceiro'));
assert.equal(mixedCartBlockMessagePt([house]), MARKETPLACE_MIXED_CART_MESSAGE_PT);

const checkout = readFileSync(join(__dirname, '../app/checkout/page.tsx'), 'utf8');
assert.ok(checkout.includes('isMixedSellerCart'), 'checkout detects mixed cart');
assert.ok(
  checkout.includes('mixedCartBlockMessagePt') || checkout.includes('MARKETPLACE_MIXED_CART_MESSAGE_PT'),
  'checkout shows PT message',
);
assert.ok(checkout.includes('mixedCart'), 'checkout blocks confirm when mixed');

const cart = readFileSync(join(__dirname, '../app/carrinho/page.tsx'), 'utf8');
assert.ok(cart.includes('isMixedSellerCart'), 'cart detects mixed cart');
assert.ok(
  cart.includes('mixedCartBlockMessagePt') || cart.includes('MARKETPLACE_MIXED_CART_MESSAGE_PT'),
  'cart shows PT message',
);

const vendedor = readFileSync(join(__dirname, '../app/vendedor/page.tsx'), 'utf8');
assert.ok(vendedor.includes('Conectar Mercado Pago'), 'seller portal has connect CTA');
assert.ok(vendedor.includes('connectEnabled'), 'connect UI is flag-gated');
assert.ok(vendedor.includes('application_fee'), 'linked seller keeps platform commission as application_fee');
assert.ok(
  !vendedor.includes('em produção o pagamento continua no collector'),
  'portal must not say production always pays the store collector',
);
assert.ok(!/sem split\s+automático/i.test(vendedor), 'portal must not claim there is no automatic split');
assert.ok(vendedor.includes('repasse manual'), 'unlinked checkout still explains manual repasse');
assert.ok(/PIX/i.test(vendedor) && /recusar a taxa/i.test(vendedor), 'PIX fee refusal is not promised as automatic');

console.log('mixed-cart unit tests ok');
