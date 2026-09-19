/**
 * Phase 3 live: mocked MP HTTP — seller APP_USR + application_fee only when
 * ENABLED + ALLOW_LIVE + production + live credentials. Sandbox unchanged.
 * No real charges.
 */
import assert from 'assert';
import { MercadoPagoPaymentProvider } from './payment.provider';
import {
  PIX_APPLICATION_FEE_SKIP_REASON,
  PIX_UNAUTHORIZED_LIVE_CREDENTIALS_SKIP_REASON,
} from './pix-application-fee-fallback';

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

type Captured = { url: string; auth: string; body: Record<string, unknown>; idem: string };

function mockFetchOk(captured: Captured[]) {
  const orig = globalThis.fetch;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const headers = (init?.headers || {}) as Record<string, string>;
    captured.push({
      url: String(_input),
      auth: headers.Authorization || '',
      body: JSON.parse(String(init?.body || '{}')) as Record<string, unknown>,
      idem: headers['X-Idempotency-Key'] || '',
    });
    return new Response(
      JSON.stringify({
        id: 333,
        status: 'pending',
        payment_method_id: 'pix',
        point_of_interaction: { transaction_data: { qr_code: '0003' } },
      }),
      { status: 201 },
    );
  }) as typeof fetch;
  return orig;
}

function mockFetchFeeThenSuccess(
  captured: Captured[],
  feeMessage = 'You cannot use application_fee with this payment.',
  status = 400,
) {
  const orig = globalThis.fetch;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const headers = (init?.headers || {}) as Record<string, string>;
    const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
    captured.push({
      url: String(_input),
      auth: headers.Authorization || '',
      body,
      idem: headers['X-Idempotency-Key'] || '',
    });
    if ('application_fee' in body) {
      return new Response(
        JSON.stringify({
          message: feeMessage,
          error: status === 401 ? 'unauthorized' : 'bad_request',
          status,
        }),
        { status },
      );
    }
    return new Response(
      JSON.stringify({
        id: 445,
        status: 'pending',
        payment_method_id: 'pix',
        point_of_interaction: { transaction_data: { qr_code: '00020126LIVEFALLBACK' } },
      }),
      { status: 201 },
    );
  }) as typeof fetch;
  return orig;
}

async function main() {
  const captured: Captured[] = [];
  let orig = mockFetchOk(captured);

  try {
    setEnv('APP_ENV', 'production');
    setEnv('NODE_ENV', 'production');
    setEnv('MERCADO_PAGO_ACCESS_TOKEN', 'APP_USR-platform-live');
    setEnv('MP_MARKETPLACE_SPLIT_ENABLED', 'true');
    setEnv('MP_MARKETPLACE_SPLIT_ALLOW_LIVE', 'true');
    setEnv('PUBLIC_API_URL', 'https://example.test/api/v1');

    const p = new MercadoPagoPaymentProvider();
    await p.createIntent({
      orderId: 'ord-live-ok',
      publicId: 'SCH-LIVE-OK',
      method: 'pix',
      amount: 95,
      payerEmail: 'a@b.c',
      sellerAccessToken: 'APP_USR-seller-live',
      applicationFee: 9.5,
    });
    assert.equal(captured.length, 1);
    assert.equal(captured[0].auth, 'Bearer APP_USR-seller-live');
    assert.equal(captured[0].body.transaction_amount, 95);
    assert.equal(captured[0].body.application_fee, 9.5);
    assert.ok(!('marketplace_fee' in captured[0].body));

    captured.length = 0;
    setEnv('MP_MARKETPLACE_SPLIT_ALLOW_LIVE', 'false');
    let allowLiveOffThrew = false;
    try {
      await p.createIntent({
        orderId: 'ord-no-live',
        publicId: 'SCH-NO-LIVE',
        method: 'pix',
        amount: 95,
        sellerAccessToken: 'APP_USR-seller-live',
        applicationFee: 9.5,
      });
    } catch (e: unknown) {
      allowLiveOffThrew = true;
      assert.equal((e as { code?: string }).code, 'PHASE2_SPLIT_FORBIDDEN');
    }
    assert.equal(allowLiveOffThrew, true, 'ALLOW_LIVE=false never uses live path');
    assert.equal(captured.length, 0);

    captured.length = 0;
    setEnv('MP_MARKETPLACE_SPLIT_ALLOW_LIVE', 'true');
    setEnv('MP_MARKETPLACE_SPLIT_ENABLED', 'false');
    let enabledOffThrew = false;
    try {
      await p.createIntent({
        orderId: 'ord-disabled',
        publicId: 'SCH-DISABLED',
        method: 'pix',
        amount: 95,
        sellerAccessToken: 'APP_USR-seller-live',
        applicationFee: 9.5,
      });
    } catch (e: unknown) {
      enabledOffThrew = true;
      assert.equal((e as { code?: string }).code, 'PHASE2_SPLIT_FORBIDDEN');
    }
    assert.equal(enabledOffThrew, true, 'ENABLED=false never fees');
    assert.equal(captured.length, 0);

    captured.length = 0;
    setEnv('MP_MARKETPLACE_SPLIT_ENABLED', 'true');
    setEnv('MP_MARKETPLACE_SPLIT_ALLOW_LIVE', 'false');
    setEnv('APP_ENV', 'development');
    setEnv('NODE_ENV', 'development');
    setEnv('MERCADO_PAGO_ACCESS_TOKEN', 'TEST-platform-collector');
    await p.createIntent({
      orderId: 'ord-sandbox-still',
      publicId: 'SCH-SANDBOX-STILL',
      method: 'pix',
      amount: 95,
      sellerAccessToken: 'TEST-seller-oauth',
      applicationFee: 9.5,
    });
    assert.equal(captured.length, 1);
    assert.equal(captured[0].auth, 'Bearer TEST-seller-oauth');
    assert.equal(captured[0].body.application_fee, 9.5);

    globalThis.fetch = orig;
    captured.length = 0;
    setEnv('APP_ENV', 'production');
    setEnv('NODE_ENV', 'production');
    setEnv('MERCADO_PAGO_ACCESS_TOKEN', 'APP_USR-platform-live');
    setEnv('MP_MARKETPLACE_SPLIT_ENABLED', 'true');
    setEnv('MP_MARKETPLACE_SPLIT_ALLOW_LIVE', 'true');
    orig = mockFetchFeeThenSuccess(captured);
    const fallback = await p.createIntent({
      orderId: 'ord-live-pix-fallback',
      publicId: 'SCH-LIVE-PIX-FB',
      method: 'pix',
      amount: 95,
      payerEmail: 'a@b.c',
      sellerAccessToken: 'APP_USR-seller-live',
      applicationFee: 9.5,
      providerIdempotencyKey: 'sch-live-pix-fb',
    });
    assert.equal(captured.length, 2);
    assert.equal(captured[0].auth, 'Bearer APP_USR-seller-live');
    assert.equal(captured[0].body.application_fee, 9.5);
    assert.equal(captured[1].auth, 'Bearer APP_USR-platform-live');
    assert.ok(!('application_fee' in captured[1].body));
    assert.equal(fallback.splitMode, 'ledger_only');
    assert.equal(fallback.splitFeeSkippedReason, PIX_APPLICATION_FEE_SKIP_REASON);
    assert.equal(fallback.payload.expectedApplicationFee, 9.5);
    assert.equal(fallback.payload.qrCode, '00020126LIVEFALLBACK');

    captured.length = 0;
    globalThis.fetch = orig;
    orig = mockFetchFeeThenSuccess(captured, 'Unauthorized use of live credentials', 401);
    const credFallback = await p.createIntent({
      orderId: 'ord-live-pix-unauth',
      publicId: 'SCH-LIVE-PIX-UNAUTH',
      method: 'pix',
      amount: 95,
      sellerAccessToken: 'APP_USR-seller-live',
      applicationFee: 9.5,
      providerIdempotencyKey: 'sch-live-pix-unauth',
    });
    assert.equal(captured.length, 2);
    assert.equal(credFallback.splitMode, 'ledger_only');
    assert.equal(credFallback.splitFeeSkippedReason, PIX_UNAUTHORIZED_LIVE_CREDENTIALS_SKIP_REASON);

    captured.length = 0;
    globalThis.fetch = orig;
    orig = mockFetchFeeThenSuccess(captured);
    let cardThrew = false;
    try {
      await p.createIntent({
        orderId: 'ord-live-card',
        publicId: 'SCH-LIVE-CARD',
        method: 'card',
        amount: 100,
        cardToken: 'tok_test',
        sellerAccessToken: 'APP_USR-seller-live',
        applicationFee: 10,
      });
    } catch {
      cardThrew = true;
    }
    assert.equal(cardThrew, true, 'live card must not retry without fee (no silent 100% take)');
    assert.equal(captured.length, 1);
    assert.equal(captured[0].body.application_fee, 10);
  } finally {
    globalThis.fetch = orig;
    restore();
  }

  console.log('payment.phase3-live-intent.spec ok');
}

void main();
