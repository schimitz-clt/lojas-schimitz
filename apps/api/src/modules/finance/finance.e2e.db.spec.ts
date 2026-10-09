/**
 * COMANDO OMEGA part 1 — HTTP-level E2E (real HTTP requests against the compiled Nest app).
 *  - App compiled with tsc (same artifact type as production build → DTO validation active).
 *  - LOCAL Postgres only (refuses anything that looks remote/production).
 *  - Mercado Pago = LOCAL FAKE server labelled TEST (token TEST-FAKE-LOCAL). All real MP env vars are
 *    deleted; FINANCE_TEST_MODE=true blocks api.mercadopago.com in the adapter.
 * Uses Node's native fetch against a listening server (supertest-equivalent, no new dependency).
 */
import assert from 'assert';
import { createHmac, randomUUID } from 'crypto';
import * as argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import { FakeMercadoPagoServer } from './testing/fake-mercadopago.server';
import { bootHttpApp, compileApi } from './testing/compiled-app';

const WEBHOOK_SECRET = 'fake-local-e2e-webhook-secret-0123456789';
const REAL_MP_ENV = ['MERCADO_PAGO_ACCESS_TOKEN', 'MP_ACCESS_TOKEN', 'MERCADO_PAGO_WEBHOOK_SECRET', 'MP_WEBHOOK_SECRET', 'STAGING_MP_ACCESS_TOKEN', 'STAGING_MP_CLIENT_SECRET', 'PROD_MP_MARKETPLACE_CLIENT_SECRET', 'MERCADO_PAGO_PUBLIC_KEY', 'MERCADO_PAGO_USER_ID', 'PUBLIC_API_URL'];

function assertLocalDb() {
  const url = process.env.DATABASE_URL || '';
  if (!url || /railway|rlwy|\.internal|prod/i.test(url) || !/127\.0\.0\.1|localhost/.test(url)) throw new Error('RECUSADO: DATABASE_URL deve ser local');
}

const results: { id: string; ok: boolean }[] = [];
async function scenario(id: string, name: string, fn: () => Promise<string | void>) {
  const t0 = Date.now();
  try {
    const d = await fn();
    results.push({ id, ok: true });
    console.log(`  PASS ${id} ${name}${d ? ' — ' + d : ''} (${Date.now() - t0}ms)`);
  } catch (e: any) {
    results.push({ id, ok: false });
    console.log(`  FAIL ${id} ${name}\n${String(e?.stack || e).slice(0, 1500)}`);
  }
}

async function main() {
  assertLocalDb();
  for (const k of REAL_MP_ENV) delete process.env[k];
  const fake = new FakeMercadoPagoServer();
  await fake.start();
  Object.assign(process.env, {
    APP_ENV: 'development', NODE_ENV: 'development', PAYMENTS_PROVIDER: 'mercadopago',
    MERCADO_PAGO_ACCESS_TOKEN: 'TEST-FAKE-LOCAL', MERCADO_PAGO_WEBHOOK_SECRET: WEBHOOK_SECRET, MERCADO_PAGO_API_BASE_URL: fake.baseUrl,
    FINANCE_TEST_MODE: 'true', FINANCE_REFUNDS_ENABLED: 'true', FINANCE_RECONCILIATION_CRON_ENABLED: 'false',
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'omega-e2e-access-secret-xxxxxxxxxx',
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'omega-e2e-refresh-secret-xxxxxxxxx',
    REFRESH_COOKIE_SECURE: 'false',
  });
  console.log(`[${fake.label}] ${fake.baseUrl}`);
  console.log('compiling API with tsc (production-like decorator metadata)…');
  compileApi();
  const srv = await bootHttpApp();
  const prisma = new PrismaClient({ log: ['error'] });
  const base = srv.base;
  console.log(`API under test: ${base}`);

  let ipSeq = 1;
  const freshIp = () => `10.77.${Math.floor(ipSeq / 250)}.${(ipSeq++ % 250) + 1}`;
  async function http(method: string, path: string, opts: { cookie?: string; body?: unknown; headers?: Record<string, string>; ip?: string; rawQuery?: string } = {}) {
    const res = await fetch(`${base}${path}${opts.rawQuery ?? ''}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-forwarded-for': opts.ip ?? freshIp(), ...(opts.cookie ? { cookie: opts.cookie } : {}), ...(opts.headers || {}) },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    return { status: res.status, json, headers: res.headers };
  }
  async function login(email: string, password: string) {
    const r = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': freshIp() }, body: JSON.stringify({ email, password }) });
    assert.equal(r.status, 201, `login ${email} → ${r.status}`);
    const cookies = r.headers.getSetCookie().map((c) => c.split(';')[0]).filter((c) => /^sch_(access|refresh)=/.test(c));
    assert.ok(cookies.some((c) => c.startsWith('sch_access=')), 'sch_access cookie set');
    return cookies.join('; ');
  }
  const seller = await prisma.seller.upsert({ where: { slug: 'lojas-schimitz' }, update: {}, create: { id: '00000000-0000-4000-8000-000000000001', name: 'Lojas Schimitz', slug: 'lojas-schimitz', status: 'active' } });
  async function user(role: 'customer' | 'admin') {
    const email = `e2e-${role}-${randomUUID().slice(0, 8)}@test.local`;
    const password = 'Omega-e2e-Pass-123';
    const u = await prisma.user.create({ data: { email, passwordHash: await argon2.hash(password), name: `E2E ${role}`, role, status: 'active', phone: '51999999999' } });
    const a = await prisma.address.create({ data: { userId: u.id, label: 'Casa', cep: '91250000', street: 'Rua Teste', number: '1', district: 'Centro', city: 'Porto Alegre', uf: 'RS' } });
    return { user: u, address: a, cookie: await login(email, password) };
  }
  async function product(qty: number, price = 100) {
    const sku = `OMEGA-E2E-${randomUUID().slice(0, 8)}`;
    return prisma.product.create({ data: { sku, name: `E2E ${sku}`, slug: sku.toLowerCase(), description: 'omega financial test product', price, active: true, sellerId: seller.id, inventory: { create: { qtyOnHand: qty, qtyReserved: 0 } } } });
  }
  /** Cart → POST /orders over HTTP. */
  async function httpCheckout(b: { cookie: string; address: { id: string } }, productId: string, qty = 1) {
    const add = await http('POST', '/cart/items', { cookie: b.cookie, body: { productId, qty } });
    assert.ok([200, 201].includes(add.status), `cart add ${add.status} ${JSON.stringify(add.json)}`);
    const o = await http('POST', '/orders', { cookie: b.cookie, body: { addressId: b.address.id }, headers: { 'idempotency-key': `e2e-order-${randomUUID()}` } });
    assert.equal(o.status, 201, `order ${o.status} ${JSON.stringify(o.json)}`);
    return o.json.data;
  }
  async function httpIntent(cookie: string, orderId: string, method: 'pix' | 'card') {
    const r = await http('POST', '/payments/intents', { cookie, headers: { 'idempotency-key': `e2e-intent-${randomUUID()}` },
      body: { orderId, method, ...(method === 'card' ? { cardToken: 'TEST-FAKE-CARD-TOKEN-E2E', installments: 1, paymentMethodId: 'visa' } : {}) } });
    assert.equal(r.status, 201, `intent ${r.status} ${JSON.stringify(r.json)}`);
    return r.json.data.payment as { id: string; externalId: string; status: string };
  }
  function signedWebhook(dataId: string, requestId: string = randomUUID(), secret: string = WEBHOOK_SECRET) {
    const ts = String(Math.floor(Date.now() / 1000));
    const v1 = createHmac('sha256', secret).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest('hex');
    return { headers: { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': requestId }, body: { id: Math.floor(Math.random() * 1e12), type: 'payment', action: 'payment.updated', data: { id: dataId } }, rawQuery: `?data.id=${encodeURIComponent(dataId)}&type=payment` };
  }
  const postWebhook = (dataId: string, requestId?: string, secret?: string) => {
    const w = signedWebhook(dataId, requestId, secret);
    return http('POST', '/webhooks/mercadopago', { headers: w.headers, body: w.body, rawQuery: w.rawQuery });
  };
  const inv = (productId: string) => prisma.inventory.findUniqueOrThrow({ where: { productId } });
  const orderId = (o: any) => o.id ?? o.order?.id;

  const admin = await user('admin');
  const customer = await user('customer');
  let paidPixPaymentId = '';
  console.log('Scenarios:');

  await scenario('E01', 'HTTP checkout → PIX intent → webhook assinado → PAID → commitSale (1x)', async () => {
    const b = await user('customer');
    const p = await product(3);
    const order = await httpCheckout(b, p.id, 1);
    assert.equal((await inv(p.id)).qtyReserved, 1);
    const pay = await httpIntent(b.cookie, orderId(order), 'pix');
    assert.equal(pay.status, 'pending');
    fake.setPayment(pay.externalId, { status: 'approved', status_detail: 'accredited' });
    const reqId = randomUUID();
    const w = await postWebhook(pay.externalId, reqId);
    assert.equal(w.status, 200, JSON.stringify(w.json));
    const again = await postWebhook(pay.externalId, reqId);
    assert.equal(again.status, 200);
    const other = await postWebhook(pay.externalId); // new delivery id, same payment
    assert.equal(other.status, 200);
    const detail = await http('GET', `/orders/${order.publicId}`, { cookie: b.cookie });
    assert.equal(detail.status, 200);
    assert.equal(detail.json.data.status, 'paid');
    const row = await prisma.payment.findUniqueOrThrow({ where: { id: pay.id } });
    assert.equal(row.status, 'approved');
    assert.equal(row.financialState, 'PAID');
    const i = await inv(p.id);
    assert.equal(i.qtyOnHand, 2);
    assert.equal(i.qtyReserved, 0);
    const commits = await prisma.inventoryMovement.count({ where: { orderId: orderId(order), kind: 'COMMIT' } });
    assert.equal(commits, 1);
    const cap = await prisma.financialLedgerEntry.count({ where: { paymentId: pay.id, entryType: 'PAYMENT_CAPTURED' } });
    assert.equal(cap, 1);
    assert.equal(await prisma.paymentStateTransition.count({ where: { paymentId: pay.id, toState: 'PAID' } }), 1);
    paidPixPaymentId = pay.id;
    return `order ${order.publicId} paid; onHand 3→2; 3 deliveries → 1 commit, 1 capture`;
  });

  await scenario('E02', 'Webhook com assinatura inválida → 401, nada muda', async () => {
    const b = await user('customer');
    const p = await product(2);
    const order = await httpCheckout(b, p.id);
    const pay = await httpIntent(b.cookie, orderId(order), 'pix');
    fake.setPayment(pay.externalId, { status: 'approved', status_detail: 'accredited' });
    const w = await postWebhook(pay.externalId, undefined, 'wrong-secret-wrong-secret-wrong-secret');
    assert.equal(w.status, 401, JSON.stringify(w.json));
    assert.equal((await prisma.payment.findUniqueOrThrow({ where: { id: pay.id } })).status, 'pending');
    assert.equal(await prisma.inventoryMovement.count({ where: { orderId: orderId(order), kind: 'COMMIT' } }), 0);
    return 'rejected, payment still pending';
  });

  await scenario('E03', 'Cartão recusado (HTTP) → pagamento refused, sem captura, sem baixa', async () => {
    const b = await user('customer');
    const p = await product(2);
    const order = await httpCheckout(b, p.id);
    fake.nextCardStatus = { status: 'rejected', status_detail: 'cc_rejected_insufficient_amount' };
    const r = await http('POST', '/payments/intents', { cookie: b.cookie, headers: { 'idempotency-key': `e2e-card-${randomUUID()}` }, body: { orderId: orderId(order), method: 'card', cardToken: 'TEST-FAKE-CARD-TOKEN-E2E', installments: 1, paymentMethodId: 'visa' } });
    fake.nextCardStatus = { status: 'approved', status_detail: 'accredited' };
    assert.ok([201, 400, 402, 422].includes(r.status), `status ${r.status}`);
    const rows = await prisma.payment.findMany({ where: { orderId: orderId(order) } });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, 'refused');
    assert.equal(rows[0].financialState, 'FAILED');
    const l = await prisma.financialLedgerEntry.findMany({ where: { paymentId: rows[0].id } });
    assert.ok(l.some((x) => x.entryType === 'PAYMENT_FAILED'));
    assert.ok(!l.some((x) => x.entryType === 'PAYMENT_CAPTURED'));
    assert.equal((await inv(p.id)).qtyOnHand, 2);
    assert.equal(await prisma.inventoryMovement.count({ where: { orderId: orderId(order), kind: 'COMMIT' } }), 0);
    const o = await prisma.order.findUniqueOrThrow({ where: { id: orderId(order) } });
    return `HTTP ${r.status}, payment refused/FAILED, order ${o.status}, onHand unchanged`;
  });

  const GETS = ['health', 'dashboard', 'payments', 'discrepancies', 'chargebacks', 'refunds', 'ledger', 'audit', 'reconciliation-runs'];
  await scenario('E04', 'Admin finance GET: 401 sem sessão, 403 cliente, 200 admin', async () => {
    for (const g of GETS) {
      assert.equal((await http('GET', `/admin/finance/${g}`)).status, 401, `${g} unauth`);
      assert.equal((await http('GET', `/admin/finance/${g}`, { cookie: customer.cookie })).status, 403, `${g} customer`);
      const ok = await http('GET', `/admin/finance/${g}`, { cookie: admin.cookie });
      assert.equal(ok.status, 200, `${g} admin ${JSON.stringify(ok.json).slice(0, 200)}`);
    }
    const h = await http('GET', '/admin/finance/health', { cookie: admin.cookie });
    assert.ok(['OK', 'WARN', 'ATTENTION'].includes(h.json.data.status));
    return `${GETS.length} endpoints × (401/403/200)`;
  });

  const POSTS: { path: () => string; body: Record<string, unknown>; headers?: Record<string, string> }[] = [
    { path: () => '/admin/finance/reconcile', body: { scope: 'PAYMENT', paymentId: paidPixPaymentId } },
    { path: () => `/admin/finance/payments/${paidPixPaymentId}/reprocess`, body: {} },
    { path: () => `/admin/finance/payments/${paidPixPaymentId}/refunds`, body: { amount: 1 }, headers: { 'idempotency-key': `e2e-refund-${randomUUID()}` } },
    { path: () => `/admin/finance/payments/${paidPixPaymentId}/review`, body: { status: 'UNDER_REVIEW' } },
    { path: () => `/admin/finance/orders/${randomUUID()}/release-reservation`, body: {} },
    { path: () => `/admin/finance/discrepancies/${randomUUID()}/resolve`, body: {} },
    { path: () => `/admin/finance/refunds/${randomUUID()}/retry`, body: {} },
    { path: () => '/admin/finance/ledger/adjustments', body: { direction: 'CREDIT', amount: 1, paymentId: paidPixPaymentId }, headers: { 'idempotency-key': `e2e-adj-${randomUUID()}` } },
  ];
  await scenario('E05', 'Admin finance POST: 401/403 e 400 sem confirm/motivo (nada executado, nenhuma chamada ao provedor)', async () => {
    const refundCallsBefore = fake.count('POST', /\/refunds$/);
    const auditBefore = await prisma.financialAuditEvent.count();
    let checks = 0;
    for (const p of POSTS) {
      const full = { ...p.body, reason: 'motivo válido para o teste e2e', confirm: true };
      assert.equal((await http('POST', p.path(), { body: full, headers: p.headers })).status, 401, `${p.path()} unauth`);
      assert.equal((await http('POST', p.path(), { cookie: customer.cookie, body: full, headers: p.headers })).status, 403, `${p.path()} customer`);
      const variants: Record<string, unknown>[] = [
        { ...p.body, reason: 'motivo válido para o teste e2e' }, // no confirm
        { ...p.body, reason: 'motivo válido para o teste e2e', confirm: false },
        { ...p.body, reason: 'curto', confirm: true },
        { ...p.body, confirm: true }, // no reason
        { ...p.body, reason: 'motivo válido para o teste e2e', confirm: 'true' }, // string, not boolean
      ];
      for (const v of variants) {
        const r = await http('POST', p.path(), { cookie: admin.cookie, body: v, headers: p.headers });
        assert.equal(r.status, 400, `${p.path()} ${JSON.stringify(v)} → ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
        checks++;
      }
    }
    assert.equal(fake.count('POST', /\/refunds$/), refundCallsBefore, 'no refund reached the provider');
    assert.equal(await prisma.financialAuditEvent.count(), auditBefore, 'rejected requests write nothing');
    const pay = await prisma.payment.findUniqueOrThrow({ where: { id: paidPixPaymentId } });
    assert.equal(pay.reviewStatus, null);
    return `${POSTS.length} endpoints × 401/403 + ${checks} rejected bodies (400)`;
  });

  await scenario('E06', 'Admin actions com confirm+motivo executam e auditam (reconcile, review)', async () => {
    const r = await http('POST', '/admin/finance/reconcile', { cookie: admin.cookie, body: { scope: 'PAYMENT', paymentId: paidPixPaymentId, reason: 'conferência pontual e2e', confirm: true } });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    const v = await http('POST', `/admin/finance/payments/${paidPixPaymentId}/review`, { cookie: admin.cookie, body: { status: 'UNDER_REVIEW', reason: 'revisão manual e2e', confirm: true } });
    assert.equal(v.status, 200);
    assert.ok(await prisma.financialAuditEvent.findFirst({ where: { action: 'payment.review_marked', paymentId: paidPixPaymentId, actorId: admin.user.id } }));
    assert.ok(await prisma.financialAuditEvent.findFirst({ where: { action: 'reconciliation.requested', paymentId: paidPixPaymentId } }));
    return `reconcile=${r.json.data.status ?? 'ok'}, review audited`;
  });

  await scenario('E07', 'Ajuste manual de ledger (ADJUSTMENT_CREATED): Idempotency-Key, replay, conflito, alvo, auditoria', async () => {
    const pay = await prisma.payment.findUniqueOrThrow({ where: { id: paidPixPaymentId } });
    const ip = freshIp();
    const body = { direction: 'DEBIT', amount: 12.34, paymentId: pay.id, reason: 'tarifa bancária lançada manualmente (e2e)', confirm: true };
    const noKey = await http('POST', '/admin/finance/ledger/adjustments', { cookie: admin.cookie, body, ip });
    assert.equal(noKey.status, 400);
    assert.equal(noKey.json.error.code, 'IDEMPOTENCY_KEY_REQUIRED');
    const key = `e2e-adj-${randomUUID()}`;
    const first = await http('POST', '/admin/finance/ledger/adjustments', { cookie: admin.cookie, body, ip, headers: { 'idempotency-key': key } });
    assert.equal(first.status, 201, JSON.stringify(first.json));
    assert.equal(first.json.data.idempotent, false);
    assert.equal(first.json.data.entry.entryType, 'ADJUSTMENT_CREATED');
    assert.equal(first.json.data.entry.orderId, pay.orderId);
    const replay = await http('POST', '/admin/finance/ledger/adjustments', { cookie: admin.cookie, body, ip, headers: { 'idempotency-key': key } });
    assert.equal(replay.status, 201);
    assert.equal(replay.json.data.idempotent, true);
    assert.equal(replay.json.data.entry.id, first.json.data.entry.id);
    const conflict = await http('POST', '/admin/finance/ledger/adjustments', { cookie: admin.cookie, body: { ...body, amount: 99 }, ip, headers: { 'idempotency-key': key } });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.json.error.code, 'IDEMPOTENCY_KEY_REUSED');
    const noTarget = await http('POST', '/admin/finance/ledger/adjustments', { cookie: admin.cookie, body: { direction: 'CREDIT', amount: 1, reason: 'sem alvo — deve falhar', confirm: true }, ip, headers: { 'idempotency-key': `e2e-adj-${randomUUID()}` } });
    assert.equal(noTarget.status, 400);
    assert.equal(noTarget.json.error.code, 'ADJUSTMENT_TARGET_REQUIRED');
    const bad = [{ ...body, amount: 0 }, { ...body, amount: 1.234 }, { ...body, direction: 'NONE' }, { ...body, extra: 'x' }];
    for (const b of bad) {
      const r = await http('POST', '/admin/finance/ledger/adjustments', { cookie: admin.cookie, body: b, headers: { 'idempotency-key': `e2e-adj-${randomUUID()}` } });
      assert.equal(r.status, 400, `${JSON.stringify(b)} → ${r.status}`);
    }
    const rows = await prisma.financialLedgerEntry.findMany({ where: { idempotencyKey: `ADJUSTMENT_CREATED:${key}` } });
    assert.equal(rows.length, 1);
    assert.equal(Number(rows[0].amount), 12.34);
    assert.equal(rows[0].direction, 'DEBIT');
    assert.equal(rows[0].actorId, admin.user.id);
    const audits = await prisma.financialAuditEvent.findMany({ where: { action: 'ledger.adjustment_created', paymentId: pay.id } });
    assert.equal(audits.length, 1, 'audited exactly once (replay not re-audited)');
    await assert.rejects(() => prisma.$executeRawUnsafe(`UPDATE "FinancialLedgerEntry" SET "amount" = 0 WHERE "id" = '${rows[0].id}'`));
    await assert.rejects(() => prisma.$executeRawUnsafe(`DELETE FROM "FinancialLedgerEntry" WHERE "id" = '${rows[0].id}'`));
    return 'created, replay=same entry, conflict=409, append-only trigger holds';
  });

  await scenario('E08', 'Ajuste: 8 requisições simultâneas com a mesma chave → 1 lançamento; throttle 10/min por IP', async () => {
    const key = `e2e-adj-conc-${randomUUID()}`;
    const body = { direction: 'CREDIT', amount: 5, paymentId: paidPixPaymentId, reason: 'ajuste concorrente e2e', confirm: true };
    const res = await Promise.all(Array.from({ length: 8 }, () => http('POST', '/admin/finance/ledger/adjustments', { cookie: admin.cookie, body, headers: { 'idempotency-key': key } })));
    assert.ok(res.every((r) => r.status === 201), res.map((r) => r.status).join(','));
    assert.equal(res.filter((r) => r.json.data.idempotent === false).length, 1);
    assert.equal(await prisma.financialLedgerEntry.count({ where: { idempotencyKey: `ADJUSTMENT_CREATED:${key}` } }), 1);
    const ip = freshIp();
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await http('POST', '/admin/finance/ledger/adjustments', { cookie: admin.cookie, body, ip, headers: { 'idempotency-key': key } })).status);
    assert.equal(statuses.filter((s) => s === 429).length, 1, statuses.join(','));
    return `8 concurrent → 1 row; 11th call from same IP → 429`;
  });

  await scenario('E09', 'Estorno legado POST /admin/payments/:id/refund: {} continua funcionando; motivo opcional auditado', async () => {
    async function paid() {
      const b = await user('customer');
      const p = await product(2);
      const order = await httpCheckout(b, p.id);
      const pay = await httpIntent(b.cookie, orderId(order), 'pix');
      fake.setPayment(pay.externalId, { status: 'approved', status_detail: 'accredited' });
      assert.equal((await postWebhook(pay.externalId)).status, 200);
      return { pay, p };
    }
    const a = await paid();
    const r1 = await http('POST', `/admin/payments/${a.pay.id}/refund`, { cookie: admin.cookie, body: {} });
    assert.equal(r1.status, 201, JSON.stringify(r1.json));
    assert.equal((await prisma.payment.findUniqueOrThrow({ where: { id: a.pay.id } })).status, 'refunded');
    const ev1 = await prisma.financialAuditEvent.findFirstOrThrow({ where: { action: 'payment.legacy_refund_requested', paymentId: a.pay.id } });
    assert.equal(ev1.reason, null);
    assert.equal((ev1.meta as any).reasonProvided, false);
    const b = await paid();
    const r2 = await http('POST', `/admin/payments/${b.pay.id}/refund`, { cookie: admin.cookie, body: { reason: 'cliente devolveu o produto (e2e)' } });
    assert.equal(r2.status, 201);
    const ev2 = await prisma.financialAuditEvent.findFirstOrThrow({ where: { action: 'payment.legacy_refund_requested', paymentId: b.pay.id } });
    assert.equal(ev2.reason, 'cliente devolveu o produto (e2e)');
    const again = await http('POST', `/admin/payments/${b.pay.id}/refund`, { cookie: admin.cookie, body: {} });
    assert.equal(again.status, 201);
    assert.equal(again.json.data.idempotent, true);
    assert.equal(await prisma.financialAuditEvent.count({ where: { action: 'payment.legacy_refund_requested', paymentId: b.pay.id } }), 1);
    assert.equal(fake.count('POST', new RegExp(`/v1/payments/${(await prisma.payment.findUniqueOrThrow({ where: { id: b.pay.id } })).externalId}/refunds$`)), 1);
    assert.equal((await http('POST', `/admin/payments/${b.pay.id}/refund`, { cookie: customer.cookie, body: {} })).status, 403);
    return 'legacy {} OK (reason null audited), reason recorded, replay idempotent, 1 provider refund';
  });

  const counters = async () => {
    const h = await http('GET', '/admin/finance/health', { cookie: admin.cookie });
    assert.equal(h.status, 200);
    return h.json.data.process.counters as Record<string, number>;
  };
  const delta = (a: Record<string, number>, b: Record<string, number>, k: string) => (b[k] || 0) - (a[k] || 0);
  const FEED_UA = 'MercadoPago Feed v2.0 payment';

  await scenario('E10', 'IPN/Feed sem assinatura → 200 ignorado (nada muda, sem fetch); forjado não altera nada; assinado segue fonte da verdade', async () => {
    const b = await user('customer');
    const p = await product(2);
    const order = await httpCheckout(b, p.id, 1);
    const pay = await httpIntent(b.cookie, orderId(order), 'pix');
    fake.setPayment(pay.externalId, { status: 'approved', status_detail: 'accredited' });
    const getRe = new RegExp(`/v1/payments/${pay.externalId}$`);
    const gets0 = fake.count('GET', getRe);
    const ev0 = await prisma.paymentEvent.count({ where: { dataId: pay.externalId } });
    const audit0 = await prisma.auditLog.count({ where: { action: { startsWith: 'payment.webhook' } } });
    const c0 = await counters();

    // real Feed shape (query topic/id + body resource/topic, Feed UA, NO x-signature)
    const feed = await http('POST', '/webhooks/mercadopago', { headers: { 'user-agent': FEED_UA }, body: { resource: pay.externalId, topic: 'payment' }, rawQuery: `?topic=payment&id=${pay.externalId}` });
    assert.equal(feed.status, 200, JSON.stringify(feed.json));
    assert.equal(feed.json.data.reason, 'unsigned_legacy_ipn_ignored');
    assert.equal(feed.json.data.applied, false);
    // forged unsigned request claiming "approved" with a Webhook-like body + IPN topic → still ignored
    const forged = await http('POST', '/webhooks/mercadopago', { headers: { 'user-agent': FEED_UA }, body: { topic: 'payment', type: 'payment', action: 'payment.updated', status: 'approved', data: { id: pay.externalId } }, rawQuery: `?topic=payment&id=${pay.externalId}&data.id=${pay.externalId}` });
    assert.equal(forged.status, 200);
    assert.equal(forged.json.data.reason, 'unsigned_legacy_ipn_ignored');

    // nothing changed: no PaymentEvent, no provider fetch, no audit, payment/order/stock untouched
    assert.equal(await prisma.paymentEvent.count({ where: { dataId: pay.externalId } }), ev0);
    assert.equal(fake.count('GET', getRe), gets0, 'no provider fetch for unsigned IPN');
    assert.equal(await prisma.auditLog.count({ where: { action: { startsWith: 'payment.webhook' } } }), audit0);
    assert.equal((await prisma.payment.findUniqueOrThrow({ where: { id: pay.id } })).status, 'pending');
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: orderId(order) } })).status, 'awaiting_payment');
    assert.equal((await inv(p.id)).qtyReserved, 1);
    assert.equal((await inv(p.id)).qtyOnHand, 2);

    // unsigned, NOT IPN-shaped (Webhook shape without signature) → 401, own counter, not a failure
    const unsignedWebhook = await http('POST', '/webhooks/mercadopago', { body: { type: 'payment', action: 'payment.updated', data: { id: pay.externalId } }, rawQuery: `?data.id=${pay.externalId}&type=payment` });
    assert.equal(unsignedWebhook.status, 401);
    // claimed signature that is invalid (wrong secret) → 401 + webhook_failures (unchanged behaviour)
    const bad = await postWebhook(pay.externalId, randomUUID(), 'wrong-secret-wrong-secret-wrong-secret');
    assert.equal(bad.status, 401);
    // Feed UA WITH a (forged) x-signature is NOT treated as IPN → verified → 401
    const feedForgedSig = await http('POST', '/webhooks/mercadopago', { headers: { 'user-agent': FEED_UA, 'x-signature': 'ts=1,v1=' + 'c'.repeat(64), 'x-request-id': randomUUID() }, body: { topic: 'payment' }, rawQuery: `?topic=payment&id=${pay.externalId}` });
    assert.equal(feedForgedSig.status, 401);
    assert.equal((await prisma.payment.findUniqueOrThrow({ where: { id: pay.id } })).status, 'pending');
    assert.equal(fake.count('GET', getRe), gets0);

    const c1 = await counters();
    assert.equal(delta(c0, c1, 'webhook_received'), 5);
    assert.equal(delta(c0, c1, 'webhook_unsigned_ipn'), 2);
    assert.equal(delta(c0, c1, 'webhook_unsigned_rejected'), 1);
    assert.equal(delta(c0, c1, 'webhook_failures'), 2, 'only the 2 claimed-but-invalid signatures');
    assert.equal(delta(c0, c1, 'webhook_processing_failures'), 0);

    // the signed Webhook remains the source of truth → PAID
    const w = await postWebhook(pay.externalId);
    assert.equal(w.status, 200, JSON.stringify(w.json));
    assert.equal((await prisma.payment.findUniqueOrThrow({ where: { id: pay.id } })).status, 'approved');
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: orderId(order) } })).status, 'paid');
    // a late Feed after PAID changes nothing either
    const late = await http('POST', '/webhooks/mercadopago', { headers: { 'user-agent': FEED_UA }, body: { resource: pay.externalId, topic: 'payment' }, rawQuery: `?topic=payment&id=${pay.externalId}` });
    assert.equal(late.status, 200);
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: orderId(order) } })).status, 'paid');
    assert.equal((await inv(p.id)).qtyOnHand, 1);
    return 'Feed 200/ignored ×3, forged unchanged, unsigned 401, bad sig 401 ×2, signed → paid';
  });

  await scenario('E11', 'Falha de processamento (fetch MP 500) → webhook_processing_failures (alerta) + 5xx p/ retry; retry assinado recupera', async () => {
    const b = await user('customer');
    const p = await product(2);
    const order = await httpCheckout(b, p.id, 1);
    const pay = await httpIntent(b.cookie, orderId(order), 'pix');
    fake.setPayment(pay.externalId, { status: 'approved', status_detail: 'accredited' });
    const c0 = await counters();
    const h0 = await http('GET', '/health/payments');
    const r0 = h0.json?.data?.recent15m ?? h0.json?.recent15m;
    fake.failNext((m, path) => m === 'GET' && path === `/v1/payments/${pay.externalId}`, 500, 1);
    const w1 = await postWebhook(pay.externalId);
    assert.ok(w1.status >= 500, `expected 5xx, got ${w1.status}`);
    const c1 = await counters();
    assert.equal(delta(c0, c1, 'webhook_processing_failures'), 1);
    assert.equal(delta(c0, c1, 'webhook_failures'), 1);
    assert.equal(delta(c0, c1, 'webhook_unsigned_ipn'), 0);
    const h1 = await http('GET', '/health/payments');
    const r1 = h1.json?.data?.recent15m ?? h1.json?.recent15m;
    assert.equal(r1.webhookProcessingFailures - r0.webhookProcessingFailures, 1, JSON.stringify(r1));
    const w2 = await postWebhook(pay.externalId);
    assert.equal(w2.status, 200, JSON.stringify(w2.json));
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: orderId(order) } })).status, 'paid');
    return `fetch 500 → HTTP ${w1.status}, processing_failures +1 (health recent15m +1), retry → paid`;
  });

  await scenario('E12', 'Cartão aprovado na hora (HTTP) → PAID, 1 baixa e 1 captura; webhook repetido não duplica', async () => {
    const b = await user('customer');
    const p = await product(2);
    const order = await httpCheckout(b, p.id);
    fake.nextCardStatus = { status: 'approved', status_detail: 'accredited' };
    const pay = await httpIntent(b.cookie, orderId(order), 'card');
    assert.equal(pay.status, 'approved');
    const body = fake.createBodies[fake.createBodies.length - 1] as Record<string, unknown>;
    assert.equal(body.token, 'TEST-FAKE-CARD-TOKEN-E2E', 'token do cartão vai ao provedor');
    assert.equal(body.payment_method_id, 'visa');
    assert.equal((await postWebhook(pay.externalId)).status, 200);
    assert.equal((await postWebhook(pay.externalId)).status, 200);
    const o = await prisma.order.findUniqueOrThrow({ where: { id: orderId(order) } });
    assert.equal(o.status, 'paid');
    const row = await prisma.payment.findUniqueOrThrow({ where: { id: pay.id } });
    assert.equal(row.method, 'card');
    assert.equal(row.financialState, 'PAID');
    assert.equal((await inv(p.id)).qtyOnHand, 1);
    assert.equal((await inv(p.id)).qtyReserved, 0);
    assert.equal(await prisma.inventoryMovement.count({ where: { orderId: orderId(order), kind: 'COMMIT' } }), 1);
    assert.equal(await prisma.financialLedgerEntry.count({ where: { paymentId: pay.id, entryType: 'PAYMENT_CAPTURED' } }), 1);
    return `order paid na resposta; 2 webhooks → 1 commit, 1 captura`;
  });

  await scenario('E13', 'Cartão com desafio 3DS pendente → fica pendente (sem baixa); emissor aprova → webhook → PAID', async () => {
    const b = await user('customer');
    const p = await product(2);
    const order = await httpCheckout(b, p.id);
    fake.nextCardStatus = { status: 'pending', status_detail: 'pending_challenge' };
    const pay = await httpIntent(b.cookie, orderId(order), 'card');
    fake.nextCardStatus = { status: 'approved', status_detail: 'accredited' };
    assert.equal(pay.status, 'pending');
    let o = await prisma.order.findUniqueOrThrow({ where: { id: orderId(order) } });
    assert.notEqual(o.status, 'paid', 'desafio pendente não marca pago');
    assert.equal((await inv(p.id)).qtyOnHand, 2);
    assert.equal((await inv(p.id)).qtyReserved, 1, 'estoque segue reservado durante o desafio');
    assert.equal(await prisma.inventoryMovement.count({ where: { orderId: orderId(order), kind: 'COMMIT' } }), 0);
    assert.equal(await prisma.financialLedgerEntry.count({ where: { paymentId: pay.id, entryType: 'PAYMENT_CAPTURED' } }), 0);
    fake.setPayment(pay.externalId, { status: 'approved', status_detail: 'accredited' });
    assert.equal((await postWebhook(pay.externalId)).status, 200);
    o = await prisma.order.findUniqueOrThrow({ where: { id: orderId(order) } });
    assert.equal(o.status, 'paid');
    assert.equal((await inv(p.id)).qtyOnHand, 1);
    assert.equal(await prisma.inventoryMovement.count({ where: { orderId: orderId(order), kind: 'COMMIT' } }), 1);
    return 'pending_challenge → pendente/reservado; aprovado via webhook → paid, 1 commit';
  });

  await scenario('E14', 'Cartão com desafio 3DS que falha → recusado via webhook, sem baixa nem captura', async () => {
    const b = await user('customer');
    const p = await product(2);
    const order = await httpCheckout(b, p.id);
    fake.nextCardStatus = { status: 'pending', status_detail: 'pending_challenge' };
    const pay = await httpIntent(b.cookie, orderId(order), 'card');
    fake.nextCardStatus = { status: 'approved', status_detail: 'accredited' };
    assert.equal(pay.status, 'pending');
    fake.setPayment(pay.externalId, { status: 'rejected', status_detail: 'cc_rejected_3ds_challenge' });
    assert.equal((await postWebhook(pay.externalId)).status, 200);
    const row = await prisma.payment.findUniqueOrThrow({ where: { id: pay.id } });
    assert.equal(row.status, 'refused');
    assert.equal(row.financialState, 'FAILED');
    const o = await prisma.order.findUniqueOrThrow({ where: { id: orderId(order) } });
    assert.notEqual(o.status, 'paid');
    assert.equal((await inv(p.id)).qtyOnHand, 2);
    assert.equal(await prisma.inventoryMovement.count({ where: { orderId: orderId(order), kind: 'COMMIT' } }), 0);
    assert.equal(await prisma.financialLedgerEntry.count({ where: { paymentId: pay.id, entryType: 'PAYMENT_CAPTURED' } }), 0);
    return `cc_rejected_3ds_challenge → refused/FAILED, order ${o.status}, onHand intacto`;
  });

  await prisma.product.updateMany({ where: { sku: { startsWith: 'OMEGA-E2E-' } }, data: { active: false } });
  await srv.close();
  await prisma.$disconnect();
  await fake.stop();
  const bad = fake.calls.filter((c) => !c.path.startsWith('/v1/'));
  assert.equal(bad.length, 0);
  const passed = results.filter((r) => r.ok).length;
  console.log(`\nfinance.e2e.db.spec: ${passed} PASS / ${results.length - passed} FAIL (fake provider calls: ${fake.calls.length}, all local TEST)`);
  if (passed !== results.length) process.exit(1);
  process.exit(0);
}

main().catch((e) => {
  console.error('finance.e2e.db.spec FATAL', e);
  process.exit(1);
});
