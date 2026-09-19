/**
 * Phase 2: fetch/refund on seller collector uses the override token (mocked HTTP).
 */
import assert from 'assert';
import { MercadoPagoPaymentProvider } from './payment.provider';

const saved: Record<string, string | undefined> = {};
function setEnv(k: string, v: string | undefined) {
  saved[k] = process.env[k];
  if (v === undefined) delete process.env[k];
  else process.env[k] = v;
}
function restore() {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

async function main() {
  setEnv('APP_ENV', 'development');
  setEnv('MERCADO_PAGO_ACCESS_TOKEN', 'TEST-platform-collector');

  const captured: { url: string; auth: string; method: string }[] = [];
  const orig = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = (init?.headers || {}) as Record<string, string>;
    const url = String(input);
    captured.push({
      url,
      auth: headers.Authorization || '',
      method: String(init?.method || 'GET'),
    });
    if (url.includes('/refunds')) {
      return new Response(JSON.stringify({ id: 9, status: 'approved' }), { status: 201 });
    }
    const alreadyRefunded = captured.some((c) => c.url.includes('/refunds'));
    return new Response(
      JSON.stringify({
        id: 333,
        status: alreadyRefunded ? 'refunded' : 'approved',
        transaction_amount: 95,
        external_reference: 'SCH-WH',
      }),
      { status: 200 },
    );
  }) as typeof fetch;

  try {
    const p = new MercadoPagoPaymentProvider();
    const fetched = await p.fetchPayment('333', { accessToken: 'TEST-seller-oauth' });
    assert.equal(fetched.status, 'approved');
    assert.equal(fetched.amount, 95);
    assert.equal(captured[0].auth, 'Bearer TEST-seller-oauth');
    assert.ok(captured[0].url.includes('/v1/payments/333'));

    const refunded = await p.refund('333', undefined, { accessToken: 'TEST-seller-oauth' });
    assert.equal(refunded.status, 'refunded');
    const refundCall = captured.find((c) => c.url.includes('/refunds'));
    assert.ok(refundCall);
    assert.equal(refundCall?.auth, 'Bearer TEST-seller-oauth');
  } finally {
    globalThis.fetch = orig;
    restore();
  }

  console.log('payment.phase2-webhook-refund.spec ok');
}

void main();
