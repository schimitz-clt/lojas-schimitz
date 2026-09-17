import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  buildCardIntentBody,
  CARD_BRICK_INSTALLMENTS_HINT,
  CARD_UNAVAILABLE_COPY,
  cardBrickPaymentMethodsCustomization,
  isCardBrickAvailable,
  mapBrickFormDataToCardSubmit,
} from './card-payment-ui';
import { MAX_INSTALLMENTS } from './pricing';

assert.equal(isCardBrickAvailable(''), false);
assert.equal(isCardBrickAvailable(null), false);
assert.equal(isCardBrickAvailable('TEST'), false);
assert.equal(isCardBrickAvailable('TEST-abc-public-key-long'), true);
assert.equal(isCardBrickAvailable(' APP_USR-xxxxxxxx '), true);

const mapped = mapBrickFormDataToCardSubmit({
  token: 'tok_abc12345',
  installments: 3,
  payment_method_id: 'visa',
});
assert.equal(mapped.cardToken, 'tok_abc12345');
assert.equal(mapped.installments, 3);
assert.equal(mapped.paymentMethodId, 'visa');

const body = buildCardIntentBody('order-uuid', mapped);
assert.equal(body.method, 'card');
assert.equal(body.cardToken, 'tok_abc12345');
assert.equal(body.installments, 3);
assert.equal(body.paymentMethodId, 'visa');
assert.ok(!('pan' in body) && !('cvv' in body) && !('cardNumber' in body));

assert.throws(
  () => buildCardIntentBody('order-uuid', { cardToken: '', installments: 1 }),
  /cardToken/,
);
assert.throws(
  () => buildCardIntentBody('order-uuid', { cardToken: 'short', installments: 1 }),
  /cardToken/,
);

assert.ok(CARD_UNAVAILABLE_COPY.includes('indisponível'));

const pmCustom = cardBrickPaymentMethodsCustomization();
assert.equal(pmCustom.minInstallments, 1);
assert.equal(pmCustom.maxInstallments, MAX_INSTALLMENTS);
assert.equal(pmCustom.maxInstallments, 12);
assert.ok(CARD_BRICK_INSTALLMENTS_HINT.includes('Mercado Pago'));
assert.ok(CARD_BRICK_INSTALLMENTS_HINT.includes('cartão'));
assert.ok(!/sempre\s+12x/i.test(CARD_BRICK_INSTALLMENTS_HINT), 'hint must not promise always 12x');

const pedido = readFileSync(join(__dirname, '../app/pedidos/[publicId]/page.tsx'), 'utf8');
assert.ok(pedido.includes('MercadoPagoCardBrick'), 'order page mounts Card Brick');
assert.ok(pedido.includes('isCardBrickAvailable') || pedido.includes('MP_PUBLIC_KEY'), 'gates on public key');
assert.ok(pedido.includes('CARD_UNAVAILABLE_COPY') || pedido.includes('indisponível'), 'unavailable copy when no key');
assert.ok(!pedido.includes('placeholder="cardToken'), 'manual cardToken paste removed');
assert.ok(!/Monte o Checkout Bricks no cliente e cole o token/.test(pedido), 'dev paste hint removed');

const brick = readFileSync(join(__dirname, '../components/MercadoPagoCardBrick.tsx'), 'utf8');
assert.ok(brick.includes('sdk.mercadopago.com/js/v2'), 'loads official MP SDK script');
assert.ok(brick.includes("create('cardPayment'") || brick.includes('create("cardPayment"'), 'creates cardPayment brick');
assert.ok(brick.includes('mapBrickFormDataToCardSubmit') || brick.includes('cardToken'), 'submits token only');
assert.ok(brick.includes('cardBrickPaymentMethodsCustomization'), 'uses shared installment customization');
assert.ok(brick.includes('customization'), 'passes customization to Brick');
assert.ok(brick.includes('CARD_BRICK_INSTALLMENTS_HINT'), 'soft installment hint under Brick');
assert.ok(!/cardNumber|cvv|pan\b/i.test(brick.replace(/\/\*[\s\S]*?\*\//g, '')), 'no PAN/CVV fields in Brick wrapper');

console.log('card-payment-ui unit + source Brick tests ok');
