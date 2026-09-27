/**
 * COMANDO OMEGA — pure unit tests (no DB, no network).
 * State machine, provider observation mapping, risk rules, webhook topics, signature manifest,
 * reconciliation checks, KeyedMutex, chargeback status mapping, base-URL test guard.
 */
import assert from 'assert';
import { createHmac } from 'crypto';
import {
  PAYMENT_STATES, PAYMENT_TRANSITIONS, canPaymentTransition, assertPaymentTransition, ForbiddenPaymentTransitionError,
  stateFromLegacyStatus, currentPaymentState, targetPaymentState, resolveTargetState,
} from './payment-state-machine';
import { evaluateRisk, riskConfigFromEnv, DEFAULT_RISK_CONFIG } from './risk-engine';
import { isIgnoredWebhookTopic } from './webhook-topics';
import { chargebackStatusFromPayment, isChargebackTopic } from './chargebacks.service';
import { KeyedMutex } from './keyed-mutex';
import { checkPayment, checkOrder, checkInventory } from './reconciliation-checks';
import { startOfTodaySaoPaulo } from './finance-admin.service';
import {
  MercadoPagoPaymentProvider, buildMercadoPagoSignatureManifest, resolveMercadoPagoBaseUrl, assertNotRealMercadoPagoInTests,
} from '../payments/payment.provider';

let n = 0;
const t = (name: string, fn: () => void | Promise<void>) => ({ name, fn });
const tests = [
  t('state machine: forbidden transitions required by the brief', () => {
    for (const from of ['REFUNDED', 'CHARGEBACK_LOST', 'FAILED', 'PARTIALLY_REFUNDED'] as const) {
      assert.equal(canPaymentTransition(from, 'PAID'), false, `${from}->PAID must be forbidden`);
      assert.throws(() => assertPaymentTransition(from, 'PAID'), ForbiddenPaymentTransitionError);
    }
    assert.equal(canPaymentTransition('PENDING', 'PAID'), true);
    assert.equal(canPaymentTransition('PAID', 'REFUNDED'), true);
    assert.equal(canPaymentTransition('PAID', 'PENDING'), false);
    assert.equal(canPaymentTransition('REFUNDED', 'PARTIALLY_REFUNDED'), false);
    assert.equal(canPaymentTransition('EXPIRED', 'PAID'), true, 'late PIX capture is real money');
  }),
  t('state machine: every target is a known state; terminal states have no exits', () => {
    for (const s of PAYMENT_STATES) for (const to of PAYMENT_TRANSITIONS[s]) assert.ok(PAYMENT_STATES.includes(to));
    for (const s of ['FAILED', 'REFUNDED', 'CHARGEBACK_LOST'] as const) assert.equal(PAYMENT_TRANSITIONS[s].length, 0);
    for (const s of PAYMENT_STATES) assert.equal(canPaymentTransition(s, s), true, 'same state = idempotent no-op (recorder writes nothing)');
  }),
  t('legacy status mapping', () => {
    assert.equal(stateFromLegacyStatus('pending', null), 'CREATED');
    assert.equal(stateFromLegacyStatus('pending', 'mp1'), 'PENDING');
    assert.equal(stateFromLegacyStatus('approved'), 'PAID');
    assert.equal(stateFromLegacyStatus('refused'), 'FAILED');
    assert.equal(currentPaymentState({ financialState: 'PARTIALLY_REFUNDED', status: 'approved' }), 'PARTIALLY_REFUNDED');
    assert.equal(currentPaymentState({ financialState: 'garbage', status: 'refunded' }), 'REFUNDED');
  }),
  t('provider observation → target state (partial refund, dispute, chargeback)', () => {
    const L = { status: 'approved', externalId: 'x', amount: 100 };
    assert.equal(targetPaymentState(L, { rawStatus: 'approved', refundedAmount: 30 }), 'PARTIALLY_REFUNDED');
    assert.equal(targetPaymentState(L, { rawStatus: 'approved', refundedAmount: 100 }), 'REFUNDED');
    assert.equal(targetPaymentState(L, { rawStatus: 'in_mediation' }), 'IN_DISPUTE');
    assert.equal(targetPaymentState(L, { rawStatus: 'charged_back', statusDetail: 'settled' }), 'CHARGEBACK_LOST');
    assert.equal(targetPaymentState(L, { rawStatus: 'charged_back', statusDetail: 'reimbursed' }), 'CHARGEBACK_WON');
    assert.equal(targetPaymentState(L, { rawStatus: 'charged_back', statusDetail: 'in_process' }), 'IN_DISPUTE');
    assert.equal(targetPaymentState({ status: 'pending', externalId: 'x', amount: 1 }, { rawStatus: 'authorized' }), 'AUTHORIZED');
    // domain refused the approval (amount mismatch): stays PENDING, never PAID
    assert.equal(targetPaymentState({ status: 'pending', externalId: 'x', amount: 1 }, { rawStatus: 'approved' }), 'PENDING');
    assert.equal(resolveTargetState('PARTIALLY_REFUNDED', L, null), 'PARTIALLY_REFUNDED', 'no obs keeps richer state');
  }),
  t('risk engine is rule-based, advisory and configurable', () => {
    const base = { orderTotal: 100, accountAgeHours: 1000, refusedAttempts: 0, ordersInWindow: 1, openReconciliationForOrder: false, priorChargebacks: 0 };
    assert.equal(evaluateRisk(base).decision, 'ALLOW');
    assert.equal(evaluateRisk({ ...base, orderTotal: 6000 }).decision, 'ALLOW', 'one weak signal alone never flags');
    const r = evaluateRisk({ ...base, orderTotal: 6000, accountAgeHours: 2 });
    assert.equal(r.decision, 'REVIEW');
    assert.deepEqual(r.hits.map((h) => h.ruleId).sort(), ['R001_HIGH_VALUE', 'R002_NEW_ACCOUNT_HIGH_VALUE']);
    assert.equal(evaluateRisk({ ...base, priorChargebacks: 1 }).decision, 'REVIEW');
    const cfg = riskConfigFromEnv({ FINANCE_RISK_RULES_JSON: JSON.stringify({ highValueThreshold: 50, disabledRules: ['R006_PRIOR_CHARGEBACK'] }) } as any);
    assert.equal(cfg.highValueThreshold, 50);
    assert.equal(evaluateRisk({ ...base, priorChargebacks: 3 }, cfg).hits.some((h) => h.ruleId === 'R006_PRIOR_CHARGEBACK'), false);
    assert.deepEqual(riskConfigFromEnv({ FINANCE_RISK_RULES_JSON: '{bad' } as any), DEFAULT_RISK_CONFIG);
  }),
  t('webhook topics: merchant_order ignored, chargebacks routed, payment default', () => {
    assert.equal(isIgnoredWebhookTopic('merchant_order'), true);
    assert.equal(isIgnoredWebhookTopic('payment'), false);
    assert.equal(isIgnoredWebhookTopic(undefined), false);
    assert.equal(isChargebackTopic('topic_chargebacks_wh'), true);
    assert.equal(isChargebackTopic('payment', 'payment.updated'), false);
  }),
  t('chargeback status from payment status/detail', () => {
    assert.equal(chargebackStatusFromPayment('charged_back', 'settled'), 'LOST');
    assert.equal(chargebackStatusFromPayment('charged_back', 'reimbursed'), 'WON');
    assert.equal(chargebackStatusFromPayment('charged_back', null), 'OPENED');
    assert.equal(chargebackStatusFromPayment('in_mediation', null), 'IN_REVIEW');
    assert.equal(chargebackStatusFromPayment('approved', null), null);
  }),
  t('signature: query data.id preferred; documented omit-absent manifest accepted', async () => {
    const secret = 'unit-test-webhook-secret-0123456789';
    const prev = { ...process.env };
    process.env.MERCADO_PAGO_WEBHOOK_SECRET = secret;
    process.env.APP_ENV = 'development';
    try {
      const mp = new MercadoPagoPaymentProvider();
      const sign = (m: string) => createHmac('sha256', secret).update(m).digest('hex');
      const ts = '1700000000';
      const ok = await mp.verifyWebhook({
        headers: { 'x-signature': `ts=${ts},v1=${sign(`id:123;request-id:req-1;ts:${ts};`)}`, 'x-request-id': 'req-1' },
        body: { id: 999, type: 'payment', action: 'payment.updated', data: { id: 'IGNORED-BODY' } },
        query: { 'data.id': '123', type: 'payment' },
      } as any);
      assert.equal(ok.dataId, '123');
      assert.equal(ok.notificationId, '999');
      assert.equal(ok.action, 'payment.updated');
      assert.equal(buildMercadoPagoSignatureManifest({ dataId: '5', ts: '9' }), 'id:5;ts:9;');
      const noReq = await mp.verifyWebhook({
        headers: { 'x-signature': `ts=${ts},v1=${sign(`id:5;ts:${ts};`)}` },
        body: { data: { id: '5' } },
      } as any);
      assert.equal(noReq.dataId, '5');
      await assert.rejects(() => mp.verifyWebhook({ headers: { 'x-signature': `ts=${ts},v1=deadbeef`, 'x-request-id': 'r' }, body: { data: { id: '5' } } } as any));
    } finally {
      process.env = prev;
    }
  }),
  t('test guards: base URL override ignored when prod-like; FINANCE_TEST_MODE blocks real host', () => {
    assert.equal(resolveMercadoPagoBaseUrl({ MERCADO_PAGO_API_BASE_URL: 'http://127.0.0.1:1', APP_ENV: 'development' } as any), 'http://127.0.0.1:1');
    assert.equal(resolveMercadoPagoBaseUrl({ MERCADO_PAGO_API_BASE_URL: 'http://127.0.0.1:1', APP_ENV: 'production' } as any), 'https://api.mercadopago.com');
    assert.throws(() => assertNotRealMercadoPagoInTests('https://api.mercadopago.com', { FINANCE_TEST_MODE: 'true' } as any));
    assert.doesNotThrow(() => assertNotRealMercadoPagoInTests('http://127.0.0.1:1', { FINANCE_TEST_MODE: 'true' } as any));
  }),
  t('KeyedMutex serializes per key, parallel across keys', async () => {
    const m = new KeyedMutex();
    let inside = 0, maxInside = 0;
    const order: number[] = [];
    await Promise.all(Array.from({ length: 50 }, (_, i) => m.run('k', async () => {
      inside++; maxInside = Math.max(maxInside, inside);
      await new Promise((r) => setTimeout(r, 1));
      order.push(i); inside--;
    })));
    assert.equal(maxInside, 1);
    assert.equal(order.length, 50);
    assert.equal(m.size(), 0, 'no leak');
    await assert.rejects(() => m.run('k', async () => { throw new Error('x'); }));
    assert.equal(await m.run('k', async () => 7), 7, 'error does not poison the key');
  }),
  t('reconciliation checks: payment vs provider vs ledger', () => {
    const now = new Date();
    const pay = { id: 'p', orderId: 'o', status: 'pending', financialState: 'PENDING', externalId: 'e', amount: 100, method: 'pix', updatedAt: now };
    const order = { id: 'o', publicId: 'SCH-1', status: 'awaiting_payment', total: 100, reservationExpiresAt: null };
    const noLedger = { captured: 0, refunded: 0, chargebackLost: 0, hasCapture: false };
    const types = (x: any[]) => x.map((d) => d.type).sort();
    assert.deepEqual(types(checkPayment({ payment: pay, order, provider: { status: 'approved', amount: 100 }, ledger: noLedger, refunds: [], now })), ['APPROVED_NOT_APPLIED']);
    assert.deepEqual(types(checkPayment({ payment: pay, order, provider: { status: 'approved', amount: 90 }, ledger: noLedger, refunds: [], now })), ['AMOUNT_MISMATCH', 'APPROVED_NOT_APPLIED']);
    const paid = { ...pay, status: 'approved', financialState: 'PAID' };
    const okLedger = { captured: 100, refunded: 0, chargebackLost: 0, hasCapture: true };
    assert.deepEqual(checkPayment({ payment: paid, order: { ...order, status: 'paid' }, provider: { status: 'approved', amount: 100, refundedAmount: 0 }, ledger: okLedger, refunds: [], now }), []);
    assert.deepEqual(types(checkPayment({ payment: paid, order, provider: null, ledger: okLedger, refunds: [], now })), ['APPROVED_ORDER_NOT_PAID']);
    assert.deepEqual(types(checkPayment({ payment: paid, order: { ...order, status: 'paid' }, provider: null, ledger: noLedger, refunds: [], now })), ['LEDGER_MISSING_CAPTURE']);
    assert.deepEqual(types(checkPayment({ payment: paid, order: { ...order, status: 'paid' }, provider: { status: 'refused', amount: 100 }, ledger: okLedger, refunds: [], now })), ['LOCAL_APPROVED_PROVIDER_NOT']);
    const d = checkPayment({ payment: paid, order: { ...order, status: 'cancelled' }, provider: null, ledger: okLedger, refunds: [], now });
    assert.equal(d[0].type, 'APPROVED_ON_CANCELLED_ORDER');
    assert.equal(d[0].severity, 'CRITICAL');
    const stuck = checkPayment({ payment: paid, order: { ...order, status: 'paid' }, provider: null, ledger: okLedger, refunds: [{ id: 'r', status: 'PROCESSING', amount: 10, updatedAt: new Date(now.getTime() - 3600_000) }], now });
    assert.deepEqual(types(stuck), ['REFUND_STUCK']);
  }),
  t('reconciliation checks: order + stock', () => {
    const now = new Date();
    const o = { id: 'o', publicId: 'SCH-1', status: 'paid', total: 10, reservationExpiresAt: null };
    const types = (x: any[]) => x.map((d) => d.type).sort();
    assert.deepEqual(types(checkOrder({ order: o, payments: [{ id: 'a', status: 'approved' }, { id: 'b', status: 'approved' }], movements: [], itemIds: [], now, expiryGraceMs: 0 })), ['DOUBLE_PAYMENT']);
    assert.deepEqual(types(checkOrder({ order: o, payments: [], movements: [], itemIds: [], now, expiryGraceMs: 0 })), ['ORDER_PAID_WITHOUT_PAYMENT']);
    assert.deepEqual(types(checkOrder({ order: o, payments: [{ id: 'a', status: 'approved' }], movements: [{ orderItemId: 'i', kind: 'RESERVE' }], itemIds: ['i'], now, expiryGraceMs: 0 })), ['STOCK_NOT_COMMITTED']);
    assert.deepEqual(types(checkOrder({ order: o, payments: [{ id: 'a', status: 'approved' }], movements: [{ orderItemId: 'i', kind: 'RESERVE' }, { orderItemId: 'i', kind: 'COMMIT' }, { orderItemId: 'i', kind: 'RELEASE' }], itemIds: ['i'], now, expiryGraceMs: 0 })), ['STOCK_COMMIT_AND_RELEASE']);
    const aw = { ...o, status: 'awaiting_payment', reservationExpiresAt: new Date(now.getTime() - 10_000) };
    assert.deepEqual(types(checkOrder({ order: aw, payments: [], movements: [], itemIds: [], now, expiryGraceMs: 0 })), ['RESERVATION_WITHOUT_PAYMENT']);
    assert.deepEqual(types(checkInventory([{ productId: 'p', sku: 's', qtyOnHand: 1, qtyReserved: 2, reservedByOpenOrders: 2 }])), ['STOCK_INVALID']);
    assert.deepEqual(types(checkInventory([{ productId: 'p', sku: 's', qtyOnHand: 5, qtyReserved: 1, reservedByOpenOrders: 2 }])), ['STOCK_RESERVED_DRIFT']);
  }),
  t('dashboard day boundary = 00:00 America/Sao_Paulo', () => {
    assert.equal(startOfTodaySaoPaulo(new Date('2026-09-27T02:00:00Z')).toISOString(), '2026-09-26T03:00:00.000Z');
    assert.equal(startOfTodaySaoPaulo(new Date('2026-09-27T03:00:00Z')).toISOString(), '2026-09-27T03:00:00.000Z');
  }),
];

(async () => {
  for (const x of tests) {
    await x.fn();
    n++;
    console.log(`  ok - ${x.name}`);
  }
  console.log(`finance.unit.spec PASS (${n} tests)`);
})().catch((e) => {
  console.error('finance.unit.spec FAIL', e);
  process.exit(1);
});
