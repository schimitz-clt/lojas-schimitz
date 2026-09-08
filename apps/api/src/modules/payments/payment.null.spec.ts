import assert from 'assert';
import {
  NullPaymentProvider,
  nullProviderReset,
  nullProviderSetStatus,
  isProdLikeEnv,
} from './payment.provider';

process.env.APP_ENV = 'development';
process.env.NODE_ENV = 'development';
process.env.ALLOW_NULL_PAYMENT_SIMULATE = 'true';
delete process.env.NULL_WEBHOOK_SECRET;
delete process.env.MERCADO_PAGO_WEBHOOK_SECRET;

nullProviderReset();
const p = new NullPaymentProvider();

async function main() {
  assert.equal(isProdLikeEnv(), false);

  const created = await p.createIntent({
    orderId: 'ord-1',
    publicId: 'SCH-TEST',
    method: 'pix',
    amount: 99.9,
  });
  assert.equal(created.status, 'pending');
  assert.ok(created.externalId.startsWith('null-'));
  assert.ok((created.payload as any).qrCode);

  const fetched = await p.fetchPayment(created.externalId);
  assert.equal(fetched.status, 'pending');
  assert.equal(fetched.amount, 99.9);

  nullProviderSetStatus(created.externalId, 'approved', 99.9);
  const approved = await p.fetchPayment(created.externalId);
  assert.equal(approved.status, 'approved');

  const evt = await p.verifyWebhook({
    headers: { 'x-signature': 'null-test-secret', 'x-request-id': 'req-1' },
    body: {
      id: 'evt-1',
      data: { id: created.externalId },
      status: 'refused',
      amount: 99.9,
    },
  });
  assert.equal(evt.providerEventId, 'evt-1');
  const after = await p.fetchPayment(created.externalId);
  assert.equal(after.status, 'refused');

  await p.cancelIntent(created.externalId);

  let threw = false;
  try {
    await p.verifyWebhook({
      headers: { 'x-signature': 'wrong', 'x-request-id': 'x' },
      body: { id: 'e', data: { id: '1' } },
    });
  } catch (e: any) {
    threw = true;
    assert.equal(e.status, 401);
  }
  assert.equal(threw, true);

  // Sem ALLOW_NULL_PAYMENT_SIMULATE, body.status NÃO altera store
  process.env.ALLOW_NULL_PAYMENT_SIMULATE = 'false';
  nullProviderSetStatus(created.externalId, 'pending', 99.9);
  await p.verifyWebhook({
    headers: { 'x-signature': 'null-test-secret', 'x-request-id': 'req-2' },
    body: { id: 'evt-nosim', data: { id: created.externalId }, status: 'approved', amount: 99.9 },
  });
  const still = await p.fetchPayment(created.externalId);
  assert.equal(still.status, 'pending', 'body.status ignored without ALLOW_NULL_PAYMENT_SIMULATE');

  console.log('payment.null provider tests ok');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
