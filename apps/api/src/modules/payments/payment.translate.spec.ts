import assert from 'assert';
import { MercadoPagoPaymentProvider, NullPaymentProvider, buildMercadoPagoNotificationUrl } from './payment.provider';

const nullP = new NullPaymentProvider();
const mp = new MercadoPagoPaymentProvider();

assert.equal(nullP.translateStatus('approved'), 'approved');
assert.equal(nullP.translateStatus('rejected'), 'refused');
assert.equal(nullP.translateStatus('cc_rejected_insufficient_amount'), 'refused');
assert.equal(nullP.translateStatus('cancelled'), 'cancelled');
assert.equal(nullP.translateStatus('expired'), 'expired');
assert.equal(nullP.translateStatus('refunded'), 'refunded');
assert.equal(nullP.translateStatus('charged_back'), 'unknown');
assert.equal(nullP.translateStatus('pending'), 'pending');
assert.equal(nullP.translateStatus('in_process'), 'pending');
assert.equal(nullP.translateStatus('in_mediation'), 'pending');

assert.equal(mp.translateStatus('approved'), 'approved');
assert.equal(mp.translateStatus('rejected'), 'refused');
assert.equal(mp.translateStatus('charged_back'), 'unknown');
assert.equal(mp.translateStatus('authorized'), 'pending');


assert.equal(
  buildMercadoPagoNotificationUrl('https://lojasschimitz.com.br/api/v1'),
  'https://lojasschimitz.com.br/api/v1/webhooks/mercadopago',
);
assert.equal(
  buildMercadoPagoNotificationUrl('https://lojasschimitz.com.br'),
  'https://lojasschimitz.com.br/api/v1/webhooks/mercadopago',
);
assert.equal(
  buildMercadoPagoNotificationUrl('https://example.up.railway.app/api/v1/'),
  'https://example.up.railway.app/api/v1/webhooks/mercadopago',
);
assert.equal(buildMercadoPagoNotificationUrl(''), null);
assert.equal(buildMercadoPagoNotificationUrl('   '), null);

// Contract: card intent must accept issuerId from Checkout Bricks
import { readFileSync } from 'fs';
import { join } from 'path';
const providerSrc = readFileSync(join(__dirname, 'payment.provider.ts'), 'utf8');
assert.match(providerSrc, /issuerId\?:/);
assert.match(providerSrc, /body\.issuer_id = input\.issuerId/);
const dtoSrc = readFileSync(join(__dirname, 'dto.ts'), 'utf8');
assert.match(dtoSrc, /issuerId\?:/);

console.log('payment.translate static tests ok');
