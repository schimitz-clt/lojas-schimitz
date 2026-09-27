/**
 * COMANDO OMEGA phase 2 — CONTRACT tests against REAL Mercado Pago SANDBOX payloads (no network).
 *
 * `testing/mp-sandbox-fixtures.json` was captured from the real MP sandbox (TEST- access token,
 * live_mode=false) on 2026-09-26 and sanitized. A local 127.0.0.1 server replays those exact JSON
 * bodies (and the 405 the sandbox returned for GET /v1/payments/{id}/refunds) to the REAL
 * MercadoPagoPaymentProvider, so parsing/mapping is checked against what MP actually sends.
 */
import assert from 'assert';
import { createHmac } from 'crypto';
import { createServer } from 'http';
import { AddressInfo } from 'net';
import { readFileSync } from 'fs';
import { join } from 'path';
import { targetPaymentState } from './payment-state-machine';
import { refundStatusFromProvider } from './refunds.service';
import { chargebackStatusFromPayment } from './chargebacks.service';
import { MercadoPagoPaymentProvider, mapMercadoPagoRefunds, requireMercadoPagoPayerEmail } from '../payments/payment.provider';

const FX = JSON.parse(readFileSync(join(__dirname, 'testing', 'mp-sandbox-fixtures.json'), 'utf8'));
for (const k of ['MERCADO_PAGO_ACCESS_TOKEN', 'MP_ACCESS_TOKEN', 'MERCADO_PAGO_WEBHOOK_SECRET', 'MP_WEBHOOK_SECRET', 'PUBLIC_API_URL']) delete process.env[k];

async function main() {
  const byId = new Map<string, any>();
  for (const [k, v] of Object.entries<any>(FX)) if (k !== '_meta' && v && v.id && v.transaction_amount != null) byId.set(String(v.id), v);
  const calls: string[] = [];
  let listStatus = 405;
  const srv = createServer((req, res) => {
    const path = (req.url || '').split('?')[0];
    calls.push(`${req.method} ${path}`);
    let m: RegExpMatchArray | null;
    if ((m = path.match(/^\/v1\/payments\/(\d+)\/refunds$/)) && req.method === 'GET') {
      if (listStatus === 405) { res.writeHead(405); return res.end(''); }
      res.writeHead(listStatus, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ message: 'boom' }));
    }
    if ((m = path.match(/^\/v1\/payments\/(\d+)$/)) && req.method === 'GET' && byId.has(m[1])) {
      res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(byId.get(m[1])));
    }
    res.writeHead(404, { 'content-type': 'application/json' }); res.end('{"message":"not found"}');
  });
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', () => r()));
  Object.assign(process.env, {
    APP_ENV: 'development', NODE_ENV: 'development', FINANCE_TEST_MODE: 'true',
    MERCADO_PAGO_API_BASE_URL: `http://127.0.0.1:${(srv.address() as AddressInfo).port}`,
    MERCADO_PAGO_ACCESS_TOKEN: 'TEST-FIXTURE-REPLAY', MERCADO_PAGO_WEBHOOK_SECRET: 'fixture-replay-webhook-secret-0123456789',
  });
  const mp = new MercadoPagoPaymentProvider();
  let n = 0; let fail = 0;
  const t = async (name: string, fn: () => Promise<void> | void) => {
    try { await fn(); n++; console.log(`  PASS ${name}`); } catch (e: any) { fail++; console.log(`  FAIL ${name}\n${e?.stack || e}`); }
  };

  /** fixture → [domain status, local status as persisted, expected financial state] */
  const cases: [string, string, string, string][] = [
    ['pix_created_pending', 'pending', 'pending', 'PENDING'],
    ['pix_cancelled_by_collector', 'cancelled', 'cancelled', 'CANCELLED'],
    ['card_approved_partially_refunded', 'approved', 'approved', 'PARTIALLY_REFUNDED'],
    ['card_refunded_full', 'refunded', 'refunded', 'REFUNDED'],
    ['card_refunded_after_partial_plus_remainder', 'refunded', 'refunded', 'REFUNDED'],
    ['card_rejected_other', 'refused', 'refused', 'FAILED'],
    ['card_rejected_insufficient', 'refused', 'refused', 'FAILED'],
    ['card_in_process_contingency', 'pending', 'pending', 'PENDING'],
  ];
  await t('fixtures are real sandbox objects (live_mode=false) and cover the statuses we map', () => {
    assert.match(String(FX._meta.source), /SANDBOX/);
    for (const [k] of cases) assert.equal(FX[k].live_mode, false, k);
  });
  for (const [k, domain, local, state] of cases) {
    await t(`fetchPayment(real ${k}: ${FX[k].status}/${FX[k].status_detail}) → ${domain} → ${state}`, async () => {
      const f = await mp.fetchPayment(String(FX[k].id));
      assert.equal(f.status, domain);
      assert.equal(f.rawStatus, FX[k].status);
      assert.equal(f.statusDetail, FX[k].status_detail);
      assert.equal(f.amount, FX[k].transaction_amount);
      assert.equal(f.refundedAmount, FX[k].transaction_amount_refunded);
      assert.equal(f.externalReference, FX[k].external_reference);
      assert.equal(f.externalId, String(FX[k].id)); // MP ids are JSON numbers; we store strings
      const obs = { rawStatus: f.rawStatus, statusDetail: f.statusDetail, amount: f.amount, refundedAmount: f.refundedAmount };
      assert.equal(targetPaymentState({ status: local, externalId: f.externalId, amount: f.amount }, obs), state);
      assert.equal(chargebackStatusFromPayment(f.rawStatus, f.statusDetail), null, 'not a chargeback');
    });
  }
  await t('PIX: point_of_interaction.transaction_data carries qr_code/qr_code_base64/ticket_url', async () => {
    const f = await mp.fetchPayment(String(FX.pix_created_pending.id));
    assert.ok(f.payload.qrCode && f.payload.qrCodeBase64 && f.payload.ticketUrl);
    assert.equal(FX.pix_created_pending.payment_type_id, 'bank_transfer');
    assert.match(String(FX.pix_created_pending.date_of_expiration), /T\d\d:\d\d:\d\d\.\d{3}[-+]\d\d:\d\d$/);
  });
  await t('refund object: status "approved" → COMPLETED; amount (not amount_refunded_to_payer) is the refunded value', () => {
    const r = FX.refund_partial_response;
    assert.equal(r.http, 201);
    assert.equal(refundStatusFromProvider(r.status), 'COMPLETED');
    assert.notEqual(r.amount_refunded_to_payer, r.amount, 'sandbox reports a different amount_refunded_to_payer — we must not use it');
    assert.equal(FX.card_approved_partially_refunded.transaction_amount_refunded, r.amount);
  });
  await t('same X-Idempotency-Key with a different amount → MP returns the ORIGINAL refund (HTTP 200); our keys are per refund row', () => {
    const a = FX.refund_partial_response; const b = FX.refund_same_key_different_amount_response;
    assert.equal(b.http, 200); assert.equal(b.id, a.id); assert.equal(b.amount, a.amount);
  });
  await t('listRefunds: sandbox 405 on GET /refunds → falls back to payment.refunds[]', async () => {
    listStatus = 405; calls.length = 0;
    const id = String(FX.card_refunded_after_partial_plus_remainder.id);
    const rows = await mp.listRefunds(id);
    assert.deepEqual(rows, mapMercadoPagoRefunds(FX.card_refunded_after_partial_plus_remainder.refunds));
    assert.equal(rows.length, 2);
    assert.ok(rows.every((r) => r.status === 'approved' && r.refundId && r.amount > 0));
    assert.deepEqual(calls, [`GET /v1/payments/${id}/refunds`, `GET /v1/payments/${id}`]);
  });
  await t('listRefunds: other errors (500) still surface (no silent fallback)', async () => {
    listStatus = 500;
    await assert.rejects(() => mp.listRefunds(String(FX.card_refunded_full.id)), (e: any) => e.status === 500);
    listStatus = 405;
  });
  await t('payer.email: sandbox rejects the old fallback; missing/malformed e-mail fails locally (no MP call)', async () => {
    assert.equal(FX.error_invalid_payer_email.http, 400);
    for (const bad of [undefined, '', '  ', 'x@y', 'no-at.example.com', 'a@b', 'a b@example.com', 'a@@example.com']) assert.throws(() => requireMercadoPagoPayerEmail(bad), (e: any) => e.code === 'PAYER_EMAIL_INVALID', String(bad));
    assert.equal(requireMercadoPagoPayerEmail(' comprador@example.com '), 'comprador@example.com');
    calls.length = 0;
    await assert.rejects(() => mp.createIntent({ orderId: 'o1', publicId: 'SCH-X', method: 'pix', amount: 10 } as any), (e: any) => e.code === 'PAYER_EMAIL_INVALID');
    assert.equal(calls.length, 0);
  });
  await t('documented error shapes: refund on pending PIX = 400/2063, over-refund = 400/2017 (→ refund FAILED, 4xx path)', () => {
    assert.deepEqual([FX.error_refund_pending_pix.http, FX.error_refund_pending_pix.cause_code], [400, 2063]);
    assert.deepEqual([FX.error_over_refund.http, FX.error_over_refund.cause_code], [400, 2017]);
  });
  await t('webhook x-signature (docs format "ts=…,v1=…", manifest id:<data.id>;request-id:<x-request-id>;ts:<ts>;) over a real sandbox id', async () => {
    const id = String(FX.card_approved_partially_refunded.id);
    const ts = String(Math.floor(Date.now() / 1000)); const reqId = 'b2d7c1d0-5f0e-4a8e-9a57-0c1b1f2e3d4a';
    const v1 = createHmac('sha256', process.env.MERCADO_PAGO_WEBHOOK_SECRET!).update(`id:${id};request-id:${reqId};ts:${ts};`).digest('hex');
    const body = { action: 'payment.updated', api_version: 'v1', data: { id }, date_created: new Date().toISOString(), id: 123456789, live_mode: false, type: 'payment', user_id: '2954551375' };
    const ev = await mp.verifyWebhook({ headers: { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': reqId }, body, query: { 'data.id': id, type: 'payment' } });
    assert.equal(ev.externalId, id); assert.equal(ev.dataId, id); assert.equal(ev.topic, 'payment'); assert.equal(ev.providerEventId, reqId);
    await assert.rejects(() => mp.verifyWebhook({ headers: { 'x-signature': `ts=${ts},v1=${'0'.repeat(64)}`, 'x-request-id': reqId }, body, query: { 'data.id': id } }), (e: any) => e.status === 401);
    await assert.rejects(() => mp.verifyWebhook({ headers: { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': reqId }, body, query: { 'data.id': String(FX.card_refunded_full.id) } }), (e: any) => e.status === 401, 'signature bound to data.id');
  });

  await new Promise<void>((r) => srv.close(() => r()));
  console.log(`\nfinance.mp-sandbox-contract.spec: ${n} PASS / ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
