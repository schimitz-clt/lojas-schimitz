/**
 * Phase 2 sandbox: PIX application_fee rejected by MP → one retry without fee
 * on the platform collector. Production live APP_USR stays fail-closed.
 */
import assert from 'assert';
import { MercadoPagoPaymentProvider } from './payment.provider';
import { PIX_APPLICATION_FEE_SKIP_REASON } from './pix-application-fee-fallback';

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

function mockFetchFeeThenSuccess(captured: Captured[]) {
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
          message: 'You cannot use application_fee with this payment.',
          error: 'bad_request',
          status: 400,
        }),
        { status: 400 },
      );
    }
    return new Response(
      JSON.stringify({
        id: 444,
        status: 'pending',
        payment_method_id: 'pix',
        point_of_interaction: { transaction_data: { qr_code: '00020126FALLBACKPIX' } },
      }),
      { status: 201 },
    );
  }) as typeof fetch;
  return orig;
}

async function main() {
  const captured: Captured[] = [];
  const orig = mockFetchFeeThenSuccess(captured);

  try {
    setEnv('APP_ENV', 'staging');
    setEnv('NODE_ENV', 'production');
    setEnv('MERCADO_PAGO_ACCESS_TOKEN', 'APP_USR-platform-test');
    setEnv('MP_MARKETPLACE_SPLIT_ENABLED', 'true');
    setEnv('MP_MARKETPLACE_SPLIT_ALLOW_LIVE', 'false');
    setEnv('PUBLIC_API_URL', 'https://example.test/api/v1');

    const p = new MercadoPagoPaymentProvider();
    const result = await p.createIntent({
      orderId: 'ord-pix-fee',
      publicId: 'SCH-PIX-FEE',
      method: 'pix',
      amount: 95,
      payerEmail: 'a@b.c',
      sellerAccessToken: 'APP_USR-seller-test',
      applicationFee: 9.5,
      providerIdempotencyKey: 'sch-pay-pix-fee',
    });

    assert.equal(captured.length, 2, 'first call with fee, second without');
    assert.equal(captured[0].auth, 'Bearer APP_USR-seller-test');
    assert.equal(captured[0].body.application_fee, 9.5);
    assert.equal(captured[0].idem, 'sch-pay-pix-fee');
    assert.equal(captured[1].auth, 'Bearer APP_USR-platform-test', 'retry uses platform collector');
    assert.ok(!('application_fee' in captured[1].body), 'retry must not send application_fee');
    assert.equal(captured[1].body.transaction_amount, 95);
    assert.equal(captured[1].idem, 'sch-pay-pix-fee-nfee');
    assert.equal(result.externalId, '444');
    assert.equal(result.status, 'pending');
    assert.equal(result.splitMode, 'ledger_only');
    assert.equal(result.splitFeeSkippedReason, PIX_APPLICATION_FEE_SKIP_REASON);
    assert.equal(result.payload.splitMode, 'ledger_only');
    assert.equal(result.payload.splitFeeSkippedReason, PIX_APPLICATION_FEE_SKIP_REASON);
    assert.equal(result.payload.expectedApplicationFee, 9.5);
    assert.equal(result.payload.qrCode, '00020126FALLBACKPIX');

    captured.length = 0;
    setEnv('APP_ENV', 'production');
    setEnv('NODE_ENV', 'production');
    setEnv('MERCADO_PAGO_ACCESS_TOKEN', 'APP_USR-platform-live');
    let liveThrew = false;
    try {
      await p.createIntent({
        orderId: 'ord-live',
        publicId: 'SCH-LIVE',
        method: 'pix',
        amount: 95,
        sellerAccessToken: 'APP_USR-seller-live',
        applicationFee: 9.5,
      });
    } catch (e: unknown) {
      liveThrew = true;
      assert.equal((e as { code?: string }).code, 'PHASE2_SPLIT_FORBIDDEN');
    }
    assert.equal(liveThrew, true, 'production live APP_USR must not send or retry application_fee');
    assert.equal(captured.length, 0);

    captured.length = 0;
    setEnv('APP_ENV', 'staging');
    setEnv('MERCADO_PAGO_ACCESS_TOKEN', 'APP_USR-platform-test');
    const otherErrOrig = globalThis.fetch;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = (init?.headers || {}) as Record<string, string>;
      captured.push({
        url: String(_input),
        auth: headers.Authorization || '',
        body: JSON.parse(String(init?.body || '{}')) as Record<string, unknown>,
        idem: headers['X-Idempotency-Key'] || '',
      });
      return new Response(JSON.stringify({ message: 'internal_error', status: 500 }), { status: 500 });
    }) as typeof fetch;
    let otherThrew = false;
    try {
      await p.createIntent({
        orderId: 'ord-other',
        publicId: 'SCH-OTHER',
        method: 'pix',
        amount: 95,
        sellerAccessToken: 'APP_USR-seller-test',
        applicationFee: 9.5,
      });
    } catch {
      otherThrew = true;
    }
    globalThis.fetch = otherErrOrig;
    assert.equal(otherThrew, true);
    assert.equal(captured.length, 1, 'unrelated MP errors must not retry');
  } finally {
    globalThis.fetch = orig;
    restore();
  }

  console.log('payment.phase2-pix-fee-fallback.spec ok');
}

void main();
