/**
 * SCH-003 — harden de secret fraco + HMAC Mercado Pago (sem cobrança).
 */
import assert from 'assert';
import { createHmac, randomBytes } from 'crypto';
import {
  MercadoPagoPaymentProvider,
  NullPaymentProvider,
  assertStrongWebhookSecret,
  isProdLikeEnv,
  allowNullPaymentSimulate,
  createPaymentProviderFromEnv,
} from './payment.provider';

async function main() {
  const prev = { ...process.env };

  // --- assertStrongWebhookSecret ---
  let weak = false;
  try {
    assertStrongWebhookSecret('null-test-secret', 't');
  } catch (e: any) {
    weak = e.code === 'WEBHOOK_SECRET_INSECURE';
  }
  assert.equal(weak, true, 'null-test-secret must be rejected by assertStrong');

  weak = false;
  try {
    assertStrongWebhookSecret('short', 't');
  } catch (e: any) {
    weak = e.code === 'WEBHOOK_SECRET_INSECURE';
  }
  assert.equal(weak, true);

  assertStrongWebhookSecret(randomBytes(24).toString('hex'), 't'); // ≥16 ok

  // --- Null provider rejects weak secret in production ---
  process.env.APP_ENV = 'production';
  process.env.NODE_ENV = 'production';
  delete process.env.NULL_WEBHOOK_SECRET;
  delete process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  delete process.env.ALLOW_NULL_PROVIDER_IN_PROD;
  process.env.PAYMENTS_PROVIDER = 'null';

  let bootBlocked = false;
  try {
    createPaymentProviderFromEnv();
  } catch (e: any) {
    bootBlocked = String(e.message).includes('PAYMENTS_PROVIDER=null');
  }
  assert.equal(bootBlocked, true, 'null provider blocked in production');

  const nullP = new NullPaymentProvider();
  let threw401 = false;
  try {
    await nullP.verifyWebhook({
      headers: { 'x-signature': 'null-test-secret' },
      body: { id: 'e1', data: { id: '1' } },
    });
  } catch (e: any) {
    threw401 = e.status === 401 && (e.code === 'WEBHOOK_SECRET_INSECURE' || e.code === 'WEBHOOK_SIGNATURE_INVALID');
  }
  assert.equal(threw401, true, 'prod null verify must fail without strong secret');

  // --- MP HMAC verify with strong secret (local, no network) ---
  process.env.APP_ENV = 'development';
  process.env.NODE_ENV = 'development';
  const secret = randomBytes(32).toString('hex');
  process.env.MERCADO_PAGO_WEBHOOK_SECRET = secret;
  process.env.MERCADO_PAGO_ACCESS_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN || 'APP_USR-placeholder-for-unit';

  const mp = new MercadoPagoPaymentProvider();
  const dataId = '1234567890';
  const requestId = 'req-hmac-1';
  const ts = String(Math.floor(Date.now() / 1000));
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac('sha256', secret).update(manifest).digest('hex');

  const ok = await mp.verifyWebhook({
    headers: {
      'x-signature': `ts=${ts},v1=${v1}`,
      'x-request-id': requestId,
    },
    body: { id: 1, type: 'payment', data: { id: dataId } },
  });
  assert.equal(ok.externalId, dataId);
  assert.ok(ok.providerEventId);

  let badSig = false;
  try {
    await mp.verifyWebhook({
      headers: {
        'x-signature': `ts=${ts},v1=${'0'.repeat(64)}`,
        'x-request-id': requestId,
      },
      body: { id: 1, type: 'payment', data: { id: dataId } },
    });
  } catch (e: any) {
    badSig = e.status === 401 && e.code === 'WEBHOOK_SIGNATURE_INVALID';
  }
  assert.equal(badSig, true, 'bad HMAC must 401');

  // restore env keys we touched (best-effort)
  for (const k of Object.keys(process.env)) {
    if (!(k in prev)) delete process.env[k];
  }
  Object.assign(process.env, prev);

  assert.equal(typeof isProdLikeEnv, 'function');
  assert.equal(typeof allowNullPaymentSimulate, 'function');
  console.log('payment.webhook-security tests ok');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
