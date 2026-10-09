/**
 * Incident 09/10/2026 (pedido SCH-MV0VVAOC-0183DE) — legacy admin refund under a slow / failing Mercado Pago.
 * Production saw: POST /admin/payments/:id/refund → HTTP 500 after ~10.8 s, refund done at MP anyway,
 * webhook finalized it, retry → 201. These scenarios pin the fixed behaviour.
 *
 * Real HTTP against the compiled Nest app, LOCAL Postgres only, Mercado Pago = LOCAL FAKE (TEST-FAKE token).
 * FINANCE_REFUNDS_ENABLED is OFF here (same as production) so the legacy path is what runs.
 */
import assert from 'assert';
import { createHmac, randomUUID } from 'crypto';
import * as argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import { FakeMercadoPagoServer } from '../finance/testing/fake-mercadopago.server';
import { bootHttpApp, compileApi } from '../finance/testing/compiled-app';

const WEBHOOK_SECRET = 'fake-local-refund-webhook-secret-0123456789';
const MP_TIMEOUT_MS = 1000;
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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  assertLocalDb();
  for (const k of REAL_MP_ENV) delete process.env[k];
  const fake = new FakeMercadoPagoServer();
  await fake.start();
  Object.assign(process.env, {
    APP_ENV: 'development', NODE_ENV: 'development', PAYMENTS_PROVIDER: 'mercadopago',
    MERCADO_PAGO_ACCESS_TOKEN: 'TEST-FAKE-LOCAL', MERCADO_PAGO_WEBHOOK_SECRET: WEBHOOK_SECRET, MERCADO_PAGO_API_BASE_URL: fake.baseUrl,
    FINANCE_TEST_MODE: 'true', FINANCE_REFUNDS_ENABLED: 'false', FINANCE_RECONCILIATION_CRON_ENABLED: 'false',
    MP_HTTP_TIMEOUT_MS: String(MP_TIMEOUT_MS),
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'omega-e2e-access-secret-xxxxxxxxxx',
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'omega-e2e-refresh-secret-xxxxxxxxx',
    REFRESH_COOKIE_SECURE: 'false',
  });
  console.log(`[${fake.label}] ${fake.baseUrl}`);
  compileApi();
  const srv = await bootHttpApp();
  const prisma = new PrismaClient({ log: ['error'] });
  const base = srv.base;

  let ipSeq = 1;
  const freshIp = () => `10.78.${Math.floor(ipSeq / 250)}.${(ipSeq++ % 250) + 1}`;
  async function http(method: string, path: string, opts: { cookie?: string; body?: unknown; headers?: Record<string, string>; rawQuery?: string } = {}) {
    const t0 = Date.now();
    const res = await fetch(`${base}${path}${opts.rawQuery ?? ''}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-forwarded-for': freshIp(), ...(opts.cookie ? { cookie: opts.cookie } : {}), ...(opts.headers || {}) },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    return { status: res.status, json, ms: Date.now() - t0 };
  }
  async function login(email: string, password: string) {
    const r = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': freshIp() }, body: JSON.stringify({ email, password }) });
    assert.equal(r.status, 201, `login ${email} → ${r.status}`);
    return r.headers.getSetCookie().map((c) => c.split(';')[0]).filter((c) => /^sch_(access|refresh)=/.test(c)).join('; ');
  }
  const seller = await prisma.seller.upsert({ where: { slug: 'lojas-schimitz' }, update: {}, create: { id: '00000000-0000-4000-8000-000000000001', name: 'Lojas Schimitz', slug: 'lojas-schimitz', status: 'active' } });
  async function user(role: 'customer' | 'admin') {
    const email = `refund-${role}-${randomUUID().slice(0, 8)}@test.local`;
    const password = 'Omega-refund-Pass-123';
    const u = await prisma.user.create({ data: { email, passwordHash: await argon2.hash(password), name: `Refund ${role}`, role, status: 'active', phone: '51999999999' } });
    const a = await prisma.address.create({ data: { userId: u.id, label: 'Casa', cep: '91250000', street: 'Rua Teste', number: '1', district: 'Centro', city: 'Porto Alegre', uf: 'RS' } });
    return { user: u, address: a, cookie: await login(email, password) };
  }
  function signedWebhook(dataId: string) {
    const requestId = randomUUID();
    const ts = String(Math.floor(Date.now() / 1000));
    const v1 = createHmac('sha256', WEBHOOK_SECRET).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest('hex');
    return { headers: { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': requestId }, body: { id: Math.floor(Math.random() * 1e12), type: 'payment', action: 'payment.updated', data: { id: dataId } }, rawQuery: `?data.id=${encodeURIComponent(dataId)}&type=payment` };
  }
  const postWebhook = (dataId: string) => {
    const w = signedWebhook(dataId);
    return http('POST', '/webhooks/mercadopago', { headers: w.headers, body: w.body, rawQuery: w.rawQuery });
  };

  const admin = await user('admin');
  const customer = await user('customer');

  /** Synthetic paid PIX order (R$ 47,40 like the incident): cart → order → intent → MP approves → signed webhook
   *  ⇒ paid (stock committed). Shipping quote comes from the CI fake Melhor Envio (MELHOR_ENVIO_BASE_URL). */
  async function paidOrder(qty = 1, stock = 5) {
    const sku = `OMEGA-REFUND-${randomUUID().slice(0, 8)}`;
    const p = await prisma.product.create({ data: { sku, name: `Refund ${sku}`, slug: sku.toLowerCase(), description: 'refund resilience test product', price: 47.4, active: true, sellerId: seller.id, inventory: { create: { qtyOnHand: stock, qtyReserved: 0 } } } });
    const add = await http('POST', '/cart/items', { cookie: customer.cookie, body: { productId: p.id, qty } });
    assert.ok([200, 201].includes(add.status), `cart ${add.status} ${JSON.stringify(add.json)}`);
    const o = await http('POST', '/orders', { cookie: customer.cookie, body: { addressId: customer.address.id }, headers: { 'idempotency-key': `refund-order-${randomUUID()}` } });
    assert.equal(o.status, 201, `order ${o.status} ${JSON.stringify(o.json)}`);
    const orderId = o.json.data.id ?? o.json.data.order?.id;
    const i = await http('POST', '/payments/intents', { cookie: customer.cookie, headers: { 'idempotency-key': `refund-intent-${randomUUID()}` }, body: { orderId, method: 'pix' } });
    assert.equal(i.status, 201, `intent ${i.status} ${JSON.stringify(i.json)}`);
    const pay = i.json.data.payment as { id: string; externalId: string };
    fake.setPayment(pay.externalId, { status: 'approved', status_detail: 'accredited' });
    assert.equal((await postWebhook(pay.externalId)).status, 200);
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status, 'paid');
    const inv = await prisma.inventory.findUniqueOrThrow({ where: { productId: p.id } });
    assert.equal(inv.qtyOnHand, stock - qty, 'stock committed on payment');
    return { pay, orderId, productId: p.id, stock, qty };
  }
  const refund = (paymentId: string, body: unknown = { reason: 'teste de resiliência (sintético)' }) =>
    http('POST', `/admin/payments/${paymentId}/refund`, { cookie: admin.cookie, body });
  const mpRefundsAt = (ext: string) => (fake.refunds.get(ext) || []).length;
  const mpPosts = (ext: string) => fake.count('POST', new RegExp(`/v1/payments/${ext}/refunds$`));
  const audits = (paymentId: string) => prisma.financialAuditEvent.findMany({ where: { action: 'payment.legacy_refund_requested', paymentId }, orderBy: { createdAt: 'asc' } });
  const onHand = async (productId: string) => (await prisma.inventory.findUniqueOrThrow({ where: { productId } })).qtyOnHand;

  console.log('Scenarios:');

  await scenario('R01', 'MP faz o estorno mas a resposta estoura o timeout → sem 500; reconsulta MP → estornado aqui; 1 estorno no MP; estoque devolvido', async () => {
    const o = await paidOrder(1);
    let delayed = false;
    fake.beforeSend = async (m, p) => {
      if (!delayed && m === 'POST' && /\/refunds$/.test(p)) { delayed = true; await sleep(MP_TIMEOUT_MS + 700); }
    };
    const r = await refund(o.pay.id);
    fake.beforeSend = null;
    assert.ok(delayed, 'fake delayed the refund reply');
    assert.notEqual(r.status, 500, JSON.stringify(r.json));
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.equal(r.json.data.outcome, 'completed');
    assert.equal((await prisma.payment.findUniqueOrThrow({ where: { id: o.pay.id } })).status, 'refunded');
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: o.orderId } })).status, 'refunded');
    assert.equal(mpRefundsAt(o.pay.externalId), 1);
    assert.equal(await onHand(o.productId), o.stock, 'restocked (order was paid)');
    const ev = await audits(o.pay.id);
    assert.equal(ev.length, 1);
    assert.equal((ev[0].meta as any).providerError, 'recovered_after_timeout');
    // repeated click after the incident: idempotent, no new POST at MP
    const before = mpPosts(o.pay.externalId);
    const again = await refund(o.pay.id, {});
    assert.equal(again.status, 201);
    assert.equal(again.json.data.idempotent, true);
    assert.equal(mpPosts(o.pay.externalId), before);
    assert.equal(mpRefundsAt(o.pay.externalId), 1);
    return `HTTP ${r.status} em ${r.ms}ms (timeout ${MP_TIMEOUT_MS}ms), 1 estorno no MP, estoque ${o.stock - 1}→${o.stock}`;
  });

  await scenario('R02', 'MP fora do ar (timeout no POST e falha na reconsulta) → 202 "em processamento"; clicar de novo usa a MESMA chave → 1 estorno só', async () => {
    const o = await paidOrder(1);
    let delayed = false;
    fake.beforeSend = async (m, p) => {
      if (!delayed && m === 'POST' && /\/refunds$/.test(p)) { delayed = true; await sleep(MP_TIMEOUT_MS + 700); }
    };
    fake.failNext((m, p) => m === 'GET' && p === `/v1/payments/${o.pay.externalId}`, 503, 1);
    const r = await refund(o.pay.id);
    fake.beforeSend = null;
    assert.equal(r.status, 202, JSON.stringify(r.json));
    assert.equal(r.json.data.outcome, 'processing');
    assert.match(r.json.data.message, /processamento/i);
    assert.match(r.json.data.message, /instantes/i);
    assert.equal((await prisma.payment.findUniqueOrThrow({ where: { id: o.pay.id } })).status, 'approved', 'not marked refunded without confirmation');
    // Admin clicks again (MP back): same X-Idempotency-Key ⇒ MP returns the ORIGINAL refund
    const again = await refund(o.pay.id);
    assert.equal(again.status, 201, JSON.stringify(again.json));
    assert.equal(again.json.data.outcome, 'completed');
    assert.equal(mpPosts(o.pay.externalId), 2, 'two POSTs reached MP…');
    assert.equal(mpRefundsAt(o.pay.externalId), 1, '…but only ONE refund exists at MP');
    const keys = new Set(fake.calls.filter((c) => c.method === 'POST' && c.path.endsWith(`/${o.pay.externalId}/refunds`)).map((c) => c.idem));
    assert.deepEqual([...keys], [`sch-refund-${o.pay.externalId}`]);
    // late webhook (refunded) is a no-op
    assert.equal((await postWebhook(o.pay.externalId)).status, 200);
    assert.equal(await onHand(o.productId), o.stock, 'restocked once');
    return '202 + mensagem PT-BR; 2º clique → 201; 2 POSTs com a mesma chave, 1 estorno no MP; estoque devolvido 1x';
  });

  await scenario('R03', 'Estorno em processamento no MP (refund in_process) → 202; webhook "refunded" conclui; novo clique idempotente', async () => {
    const o = await paidOrder(1);
    fake.refundStatus = 'in_process';
    const r = await refund(o.pay.id);
    fake.refundStatus = 'approved';
    assert.equal(r.status, 202, JSON.stringify(r.json));
    assert.equal(r.json.data.outcome, 'processing');
    assert.equal((await prisma.payment.findUniqueOrThrow({ where: { id: o.pay.id } })).status, 'approved');
    fake.setPayment(o.pay.externalId, { status: 'refunded' });
    assert.equal((await postWebhook(o.pay.externalId)).status, 200);
    assert.equal((await prisma.payment.findUniqueOrThrow({ where: { id: o.pay.id } })).status, 'refunded');
    const again = await refund(o.pay.id);
    assert.equal(again.status, 201);
    assert.equal(again.json.data.idempotent, true);
    assert.equal(mpPosts(o.pay.externalId), 1);
    assert.equal(await onHand(o.productId), o.stock);
    return 'antes respondia 400 PROVIDER_REFUND_PENDING; agora 202 e webhook conclui';
  });

  await scenario('R04', 'Cliques concorrentes (5 ao mesmo tempo, MP lento) → 1 POST no MP, 1 estorno, 1 auditoria, sem 500', async () => {
    const o = await paidOrder(1);
    fake.delayMs = 300;
    const rs = await Promise.all(Array.from({ length: 5 }, () => refund(o.pay.id)));
    fake.delayMs = 0;
    for (const r of rs) assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.equal(rs.filter((r) => r.json.data.idempotent === false).length, 1);
    assert.equal(rs.filter((r) => r.json.data.idempotent === true).length, 4);
    assert.equal(mpPosts(o.pay.externalId), 1);
    assert.equal(mpRefundsAt(o.pay.externalId), 1);
    assert.equal((await audits(o.pay.id)).length, 1);
    assert.equal(await onHand(o.productId), o.stock, 'restocked exactly once');
    return '5 cliques → 1 POST, 1 estorno, 1 auditoria, estoque devolvido 1x';
  });

  await scenario('R05', 'MP recusa (4xx definitivo) → 422 PROVIDER_REFUND_REJECTED com mensagem PT-BR; nada muda localmente', async () => {
    const o = await paidOrder(1);
    fake.refundStatus = 'rejected';
    const r = await refund(o.pay.id);
    fake.refundStatus = 'approved';
    assert.equal(r.status, 422, JSON.stringify(r.json));
    assert.equal(r.json?.error?.code ?? r.json?.code, 'PROVIDER_REFUND_REJECTED', JSON.stringify(r.json));
    assert.match(JSON.stringify(r.json), /Nada foi devolvido/);
    assert.equal((await prisma.payment.findUniqueOrThrow({ where: { id: o.pay.id } })).status, 'approved');
    assert.equal(await onHand(o.productId), o.stock - 1, 'no restock');
    return '422 + mensagem clara';
  });

  await scenario('R06', 'MP 500 no POST mas o estorno não existe lá → 202 (não 500); retry conclui com 1 estorno', async () => {
    const o = await paidOrder(1);
    fake.failNext((m, p) => m === 'POST' && p === `/v1/payments/${o.pay.externalId}/refunds`, 500, 1);
    const r = await refund(o.pay.id);
    assert.equal(r.status, 202, JSON.stringify(r.json));
    const again = await refund(o.pay.id);
    assert.equal(again.status, 201, JSON.stringify(again.json));
    assert.equal(mpRefundsAt(o.pay.externalId), 1);
    return '500 do MP → 202; retry → 201, 1 estorno';
  });

  await scenario('R07', 'Pedido já em ready_for_pickup → estorno conclui SEM devolver estoque (regra REFUND_NO_RESTOCK_STATUSES)', async () => {
    const o = await paidOrder(1);
    await prisma.order.update({ where: { id: o.orderId }, data: { status: 'ready_for_pickup' } });
    const r = await refund(o.pay.id);
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.equal(await onHand(o.productId), o.stock - 1, 'no automatic restock');
    return 'estorno OK, estoque não volta automaticamente';
  });

  await scenario('R08', 'Compat: body {} continua aceito (motivo opcional, auditado como null); cliente → 403', async () => {
    const o = await paidOrder(1);
    const r = await refund(o.pay.id, {});
    assert.equal(r.status, 201, JSON.stringify(r.json));
    const ev = await audits(o.pay.id);
    assert.equal(ev[0].reason, null);
    assert.equal((ev[0].meta as any).reasonProvided, false);
    const o2 = await paidOrder(1);
    assert.equal((await http('POST', `/admin/payments/${o2.pay.id}/refund`, { cookie: customer.cookie, body: {} })).status, 403);
  });

  await prisma.product.updateMany({ where: { sku: { startsWith: 'OMEGA-REFUND-' } }, data: { active: false } });
  await srv.close();
  await prisma.$disconnect();
  await fake.stop();
  const bad = fake.calls.filter((c) => !c.path.startsWith('/v1/'));
  assert.equal(bad.length, 0);
  const passed = results.filter((r) => r.ok).length;
  console.log(`\nadmin-refund.resilience.db.spec: ${passed} PASS / ${results.length - passed} FAIL (fake provider calls: ${fake.calls.length}, all local TEST)`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error('admin-refund.resilience.db.spec FATAL', e);
  process.exit(1);
});
