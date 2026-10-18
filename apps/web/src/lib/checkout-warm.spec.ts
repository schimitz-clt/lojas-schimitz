import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CHECKOUT_WARM_MAX_AGE_MS, sameCartPayload, takeCheckoutWarm, warmCheckout } from './checkout-warm';

assert.equal(takeCheckoutWarm(1000), null, 'nothing warmed');
warmCheckout({ items: [1] }, [{ id: 'a' }], 1000);
assert.deepEqual(takeCheckoutWarm(1000 + 5), { cart: { items: [1] }, addresses: [{ id: 'a' }] });
assert.equal(takeCheckoutWarm(1000 + 6), null, 'one-shot');
warmCheckout({ items: [1] }, null, 1000);
assert.equal(takeCheckoutWarm(1000 + CHECKOUT_WARM_MAX_AGE_MS + 1), null, 'stale seed ignored');
warmCheckout(null, null, 1000);
assert.equal(takeCheckoutWarm(1001), null, 'no cart, no seed');
assert.equal(sameCartPayload({ a: 1, b: [2] }, { a: 1, b: [2] }), true);
assert.equal(sameCartPayload({ a: 1 }, { a: 2 }), false);

const checkout = readFileSync(join(__dirname, '../app/checkout/page.tsx'), 'utf8');
assert.ok(checkout.includes('takeCheckoutWarm'), 'checkout uses the cart-page seed');
assert.ok(checkout.includes("api<Cart>('/cart')"), 'checkout still refetches the cart');
assert.ok(checkout.includes('sameCartPayload'), 'unchanged cart keeps the seeded object');
const cart = readFileSync(join(__dirname, '../app/carrinho/page.tsx'), 'utf8');
assert.ok(cart.includes('warmCheckout('), 'cart page warms checkout on Finalizar');
console.log('checkout-warm.spec ok');
