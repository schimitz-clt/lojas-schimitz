/**
 * Phase 2 sandbox: mocked MP HTTP — seller TEST- token + application_fee.
 * Production live APP_USR stays on the platform collector.
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

type Captured = { url: string; auth: string; body: Record<string, unknown> };

function mockFetch(captured: Captured[]) {
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
        id: 222,
        status: 'pending',
        payment_method_id: 'pix',
        point_of_interaction: { transaction_data: { qr_code: '0002' } },
      }),
      { status: 201 },
    );
  }) as typeof fetch;
  return orig;
}

async function main() {
  const captured: Captured[] = [];
  const orig = mockFetch(captured);

  try {
    setEnv('APP_ENV', 'development');
    setEnv('NODE_ENV', 'development');
    setEnv('MERCADO_PAGO_ACCESS_TOKEN', 'TEST-platform-collector');
    setEnv('MP_MARKETPLACE_SPLIT_ENABLED', 'true');
    setEnv('MP_MARKETPLACE_SPLIT_ALLOW_LIVE', 'false');
    setEnv('PUBLIC_API_URL', 'https://example.test/api/v1');

    const p = new MercadoPagoPaymentProvider();
    await p.createIntent({
      orderId: 'ord-2',
      publicId: 'SCH-PHASE2',
      method: 'pix',
      amount: 95,
      payerEmail: 'a@b.c',
      sellerAccessToken: 'TEST-seller-oauth',
      applicationFee: 9.5,
    });
    assert.equal(captured.length, 1);
    assert.ok(captured[0].url.includes('/v1/payments'));
    assert.equal(captured[0].auth, 'Bearer TEST-seller-oauth');
    assert.equal(captured[0].body.transaction_amount, 95);
    assert.equal(captured[0].body.application_fee, 9.5);
    assert.ok(!('marketplace_fee' in captured[0].body));
    assert.ok(!('collector_id' in captured[0].body));

    captured.length = 0;
    let liveSellerThrew = false;
    try {
      await p.createIntent({
        orderId: 'ord-3',
        publicId: 'SCH-LIVE-SELLER',
        method: 'pix',
        amount: 95,
        sellerAccessToken: 'APP_USR-seller-live',
        applicationFee: 9.5,
      });
    } catch (e: unknown) {
      liveSellerThrew = true;
      assert.equal((e as { code?: string }).code, 'PHASE2_SPLIT_FORBIDDEN');
    }
    assert.equal(liveSellerThrew, true);
    assert.equal(captured.length, 0);

    captured.length = 0;
    setEnv('APP_ENV', 'production');
    setEnv('NODE_ENV', 'production');
    setEnv('MERCADO_PAGO_ACCESS_TOKEN', 'APP_USR-platform-live');
    setEnv('MP_MARKETPLACE_SPLIT_ENABLED', 'true');
    setEnv('MP_MARKETPLACE_SPLIT_ALLOW_LIVE', 'true');
    await p.createIntent({
      orderId: 'ord-4',
      publicId: 'SCH-PROD',
      method: 'pix',
      amount: 50,
      payerEmail: 'a@b.c',
    });
    assert.equal(captured.length, 1);
    assert.equal(captured[0].auth, 'Bearer APP_USR-platform-live');
    assert.ok(!('application_fee' in captured[0].body));

    captured.length = 0;
    let prodFeeThrew = false;
    try {
      await p.createIntent({
        orderId: 'ord-5',
        publicId: 'SCH-PROD-FEE',
        method: 'pix',
        amount: 50,
        sellerAccessToken: 'TEST-seller-oauth',
        applicationFee: 5,
      });
    } catch (e: unknown) {
      prodFeeThrew = true;
      assert.equal((e as { code?: string }).code, 'PHASE2_SPLIT_FORBIDDEN');
    }
    assert.equal(prodFeeThrew, true, 'production live env must not send application_fee');
    assert.equal(captured.length, 0);
  } finally {
    globalThis.fetch = orig;
    restore();
  }

  console.log('payment.phase2-sandbox-intent.spec ok');
}

void main();
