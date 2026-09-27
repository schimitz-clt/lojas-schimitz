/**
 * Unsigned legacy IPN ("MercadoPago Feed v2.0") classification + safe rejection description +
 * notification_url with source_news=webhooks. Real adapter against the LOCAL FAKE MP server
 * (TEST-FAKE- token, 127.0.0.1) — never api.mercadopago.com.
 */
import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createHmac } from 'crypto';
import {
  MercadoPagoPaymentProvider,
  NullPaymentProvider,
  detectUnsignedLegacyNotification,
  sanitizeToken,
} from './payment.provider';
import { describeWebhookRejection } from './webhook-rejection';
import { FakeMercadoPagoServer } from '../finance/testing/fake-mercadopago.server';

const SECRET = 'unit-ipn-webhook-secret-0123456789abcdef';
const FEED_UA = 'MercadoPago Feed v2.0 payment';

function signed(dataId: string, requestId = 'req-1', secret = SECRET) {
  const ts = '1759000000';
  const v1 = createHmac('sha256', secret).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest('hex');
  return { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': requestId };
}

/** Static contract (same style as payment.orphan-reconciliation.spec): the 3 processing-failure sites feed the alert counter. */
function staticContract() {
  const svc = readFileSync(join(__dirname, 'payments.service.ts'), 'utf8');
  const body = svc.slice(svc.indexOf('async handleWebhook('), svc.indexOf('async syncFinancialAfterProviderFetch('));
  assert.equal((body.match(/financeMetrics\.inc\('webhook_processing_failures'\)/g) || []).length, 3, 'chargeback + fetch + apply');
  for (const marker of ['WEBHOOK_PROCESSING_FAILED', 'WEBHOOK_FETCH_FAILED', 'WEBHOOK_APPLY_FAILED']) {
    const i = body.indexOf(marker);
    assert.ok(i > 0, marker);
    assert.ok(body.slice(Math.max(0, i - 700), i).includes("inc('webhook_processing_failures')"), `${marker} counts a processing failure`);
  }
  // unsigned IPN branch returns before verify/persist/fetch
  const ipn = body.indexOf("inc('webhook_unsigned_ipn')");
  assert.ok(ipn > 0 && ipn < body.indexOf('verifyWebhook('), 'IPN handled before verification');
  assert.ok(ipn < body.indexOf('paymentEvent.create'), 'IPN never persisted');
  assert.ok(ipn < body.indexOf('fetchPaymentResolvingCollector'), 'IPN never fetched');
}

async function main() {
  staticContract();
  const prev = { ...process.env };
  for (const k of ['MERCADO_PAGO_ACCESS_TOKEN', 'MP_ACCESS_TOKEN', 'MERCADO_PAGO_WEBHOOK_SECRET', 'MP_WEBHOOK_SECRET', 'PUBLIC_API_URL', 'API_PREFIX']) delete process.env[k];
  const fake = new FakeMercadoPagoServer();
  await fake.start();
  Object.assign(process.env, {
    APP_ENV: 'development', NODE_ENV: 'development', FINANCE_TEST_MODE: 'true',
    MERCADO_PAGO_ACCESS_TOKEN: 'TEST-FAKE-LOCAL', MERCADO_PAGO_WEBHOOK_SECRET: SECRET, MERCADO_PAGO_API_BASE_URL: fake.baseUrl,
  });
  try {
    // --- detection: real Feed shapes (query topic/id, body resource/topic, Feed UA) ---
    const q1 = detectUnsignedLegacyNotification({ headers: { 'user-agent': FEED_UA }, body: { resource: '180169325833', topic: 'payment' }, query: { topic: 'payment', id: '180169325833' } });
    assert.deepEqual(q1, { kind: 'legacy_ipn', topic: 'payment', resourceId: '180169325833', userAgentFamily: 'feed' });
    const q2 = detectUnsignedLegacyNotification({ headers: { 'User-Agent': 'MercadoPago Feed v2.0 merchant_order' }, body: { resource: 'https://api.mercadolibre.com/merchant_orders/999', topic: 'merchant_order' }, query: {} });
    assert.equal(q2?.topic, 'merchant_order');
    assert.equal(q2?.resourceId, '999');
    const q3 = detectUnsignedLegacyNotification({ headers: { 'user-agent': FEED_UA }, body: {}, query: {} });
    assert.equal(q3?.topic, 'payment', 'topic derived from Feed UA');
    const q4 = detectUnsignedLegacyNotification({ headers: { 'user-agent': 'curl/8' }, body: {}, query: { topic: 'payment', id: '1' } });
    assert.equal(q4?.userAgentFamily, 'other', 'IPN shape without Feed UA still unsigned IPN');
    // hostile values are sanitised (no injection into logs)
    const q5 = detectUnsignedLegacyNotification({ headers: { 'user-agent': FEED_UA }, body: {}, query: { topic: 'pay"ment\n{x}', id: '12;DROP TABLE' } });
    assert.equal(q5?.topic, 'payment{x}'.replace(/[{}]/g, ''));
    assert.equal(q5?.resourceId, '12DROPTABLE');
    assert.equal(sanitizeToken('a'.repeat(100), 40).length, 40);

    // --- NOT unsigned IPN: anything with x-signature (even garbage) or a signed-Webhook shape ---
    assert.equal(detectUnsignedLegacyNotification({ headers: { 'user-agent': FEED_UA, 'x-signature': 'ts=1,v1=deadbeef' }, body: { topic: 'payment' }, query: { topic: 'payment', id: '1' } }), null);
    assert.equal(detectUnsignedLegacyNotification({ headers: { 'user-agent': 'MercadoPago WebHook v1.0 payment' }, body: { type: 'payment', action: 'payment.updated', data: { id: '1' } }, query: { 'data.id': '1', type: 'payment' } }), null);
    assert.equal(detectUnsignedLegacyNotification({ headers: {}, body: {}, query: {} }), null);
    // whitespace-only signature counts as absent
    assert.ok(detectUnsignedLegacyNotification({ headers: { 'x-signature': '   ', 'user-agent': FEED_UA }, body: {}, query: {} }));

    // --- adapter wiring: MP classifies, Null provider has no classifier (dev harness unchanged) ---
    const mp = new MercadoPagoPaymentProvider();
    assert.ok(mp.classifyUnsignedNotification({ headers: { 'user-agent': FEED_UA }, body: {}, query: { topic: 'payment', id: '5' } }));
    assert.equal((new NullPaymentProvider() as any).classifyUnsignedNotification, undefined);

    // --- a forged signature on a Feed-looking request is still rejected by verifyWebhook (401) ---
    let forged: any = null;
    try {
      await mp.verifyWebhook({ headers: { 'user-agent': FEED_UA, 'x-signature': 'ts=1,v1=' + 'a'.repeat(64), 'x-request-id': 'r' }, body: { topic: 'payment' }, query: { 'data.id': '5' } });
    } catch (e) { forged = e; }
    assert.equal(forged?.status, 401);
    assert.equal(forged?.code, 'WEBHOOK_SIGNATURE_INVALID');
    assert.equal(forged?.rejectReason, 'signature_mismatch');
    let missing: any = null;
    try { await mp.verifyWebhook({ headers: {}, body: { type: 'payment', data: { id: '5' } }, query: { 'data.id': '5' } }); } catch (e) { missing = e; }
    assert.equal(missing?.status, 401);
    assert.equal(missing?.rejectReason, 'signature_missing');
    // valid signed webhook still verifies (with source_news in the query, as MP will send it)
    const ok = await mp.verifyWebhook({ headers: signed('5'), body: { type: 'payment', data: { id: '5' } }, query: { source_news: 'webhooks', 'data.id': '5', type: 'payment' } });
    assert.equal(ok.externalId, '5');
    delete process.env.MERCADO_PAGO_WEBHOOK_SECRET;
    let noSecret: any = null;
    try { await new MercadoPagoPaymentProvider().verifyWebhook({ headers: signed('5'), body: {}, query: { 'data.id': '5' } }); } catch (e) { noSecret = e; }
    assert.equal(noSecret?.rejectReason, 'secret_missing');
    process.env.MERCADO_PAGO_WEBHOOK_SECRET = SECRET;

    // --- describeWebhookRejection: classification + NO secret material in the log fields ---
    const sigHeaders = { 'x-signature': 'ts=1759000000,v1=' + 'b'.repeat(64), 'x-request-id': 'req-9', 'user-agent': 'MercadoPago WebHook v1.0 payment\u0000\n' };
    const d1 = describeWebhookRejection(sigHeaders, { type: 'payment', data: { id: '77' } }, { 'data.id': '77', type: 'payment' }, forged);
    assert.deepEqual(d1, { reason: 'signature_mismatch', httpStatus: 401, code: 'WEBHOOK_SIGNATURE_INVALID', hasSignature: true, hasRequestId: true, hasDataId: true, topic: 'payment', userAgent: 'MercadoPago WebHook v1.0 payment' });
    const serialized = JSON.stringify(d1);
    assert.ok(!serialized.includes('bbbb'), 'no signature value');
    assert.ok(!serialized.includes('1759000000'), 'no ts value');
    assert.ok(!serialized.includes(SECRET), 'no secret');
    assert.ok(!serialized.includes('req-9'), 'no request id value');
    assert.equal(describeWebhookRejection({}, {}, {}, missing).reason, 'signature_missing');
    assert.equal(describeWebhookRejection({ 'x-signature': 'x' }, {}, {}, { status: 401 }).reason, 'signature_invalid');
    assert.equal(describeWebhookRejection({}, {}, {}, { status: 401 }).reason, 'signature_missing');
    assert.equal(describeWebhookRejection({ 'x-signature': 'x' }, {}, {}, { status: 400, code: 'WEBHOOK_EVENT_UNPARSEABLE' }).reason, 'unparseable');
    assert.equal(describeWebhookRejection({ 'x-null-signature': 'x' }, {}, {}, { status: 401 }).hasSignature, true);

    // --- createIntent sends notification_url with source_news=webhooks (to the LOCAL fake) ---
    process.env.PUBLIC_API_URL = 'https://api.example.test/api/v1';
    const intent = await new MercadoPagoPaymentProvider().createIntent({ orderId: 'o1', publicId: 'SCH-UNIT-IPN', method: 'pix', amount: 10, payerEmail: 'cliente@example.com', providerIdempotencyKey: 'unit-ipn-1' });
    assert.ok(intent.externalId);
    assert.equal(fake.createBodies.length, 1);
    assert.equal(fake.createBodies[0].notification_url, 'https://api.example.test/api/v1/webhooks/mercadopago?source_news=webhooks');
    assert.ok(fake.calls.every((c) => c.path.startsWith('/v1/')));
  } finally {
    await fake.stop();
    process.env = prev;
  }
  console.log('payment.webhook-unsigned-ipn.spec OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
