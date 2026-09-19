/**
 * Phase 1: createIntent stays on the platform token path even if split flags are on.
 * HTTP to MP is mocked — no charges.
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
  setEnv('NODE_ENV', 'development');
  setEnv('MERCADO_PAGO_ACCESS_TOKEN', 'TEST-platform-collector');
  setEnv('MP_MARKETPLACE_SPLIT_ENABLED', 'true');
  setEnv('MP_MARKETPLACE_SPLIT_ALLOW_LIVE', 'true');
  setEnv('PUBLIC_API_URL', 'https://example.test/api/v1');

  const captured: { url: string; auth: string; body: Record<string, unknown> }[] = [];
  const orig = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = (init?.headers || {}) as Record<string, string>;
    captured.push({
      url: String(input),
      auth: headers.Authorization || '',
      body: JSON.parse(String(init?.body || '{}')) as Record<string, unknown>,
    });
    return new Response(
      JSON.stringify({
        id: 111,
        status: 'pending',
        payment_method_id: 'pix',
        point_of_interaction: { transaction_data: { qr_code: '0002' } },
      }),
      { status: 201 },
    );
  }) as typeof fetch;

  try {
    const p = new MercadoPagoPaymentProvider();
    await p.createIntent({
      orderId: 'ord-1',
      publicId: 'SCH-PHASE1',
      method: 'pix',
      amount: 50,
      payerEmail: 'a@b.c',
    });
    assert.equal(captured.length, 1);
    assert.ok(captured[0].url.includes('/v1/payments'));
    assert.equal(captured[0].auth, 'Bearer TEST-platform-collector');
    const body = captured[0].body;
    assert.equal(body.transaction_amount, 50);
    assert.equal(body.external_reference, 'SCH-PHASE1');
    assert.ok(!('application_fee' in body));
    assert.ok(!('marketplace_fee' in body));
    assert.ok(!('collector_id' in body));
    assert.ok(!('sponsor_id' in body));
    assert.ok(!('disbursements' in body));
  } finally {
    globalThis.fetch = orig;
    restore();
  }

  console.log('payment.phase1-fail-closed.spec ok');
}

void main();
