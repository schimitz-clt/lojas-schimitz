/**
 * COMANDO OMEGA phase 2 — OPT-IN live E2E against the REAL Mercado Pago SANDBOX.
 *   npm run test:sandbox   (NOT part of `test` / `test:finance`)
 *
 * Safety:
 *  - Card tokens are created with MP_SANDBOX_PUBLIC_KEY (TEST-…) like the storefront Brick; without it the
 *    access token is used (flaky at MP: tokens may come back live_mode=true → BLOCKED_EXTERNAL).
 *  - Token comes ONLY from MP_SANDBOX_ACCESS_TOKEN and MUST start with "TEST-" (APP_USR-… is refused
 *    before anything boots). Never printed. All other MP env vars are deleted.
 *  - LOCAL Postgres only. APP_ENV=development. No notification_url is sent (PUBLIC_API_URL deleted),
 *    so MP never calls back anywhere; webhook delivery is SIMULATED by POSTing, to the local API, a
 *    notification signed exactly as the MP docs describe (x-signature "ts=…,v1=HMAC_SHA256(secret,
 *    id:<data.id>;request-id:<x-request-id>;ts:<ts>;)") for REAL sandbox payment ids — the handler then
 *    fetches the payment by id from the real sandbox (the production path).
 *  - Sandbox money only (live_mode=false asserted on every payment).
 */
import assert from 'assert';
import { createHmac, randomUUID } from 'crypto';
import * as argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import { bootHttpApp, compileApi } from './testing/compiled-app';

const TOKEN = String(process.env.MP_SANDBOX_ACCESS_TOKEN || '');
if (!TOKEN.startsWith('TEST-')) {
  console.error('RECUSADO: MP_SANDBOX_ACCESS_TOKEN ausente ou não é token de SANDBOX (TEST-…). Nada foi executado.');
  process.exit(2);
}
const PUBLIC_KEY = String(process.env.MP_SANDBOX_PUBLIC_KEY || '');
if (PUBLIC_KEY && !PUBLIC_KEY.startsWith('TEST-')) {
  console.error('RECUSADO: MP_SANDBOX_PUBLIC_KEY não é chave pública de SANDBOX (TEST-…). Nada foi executado.');
  process.exit(2);
}
const MP = 'https://api.mercadopago.com';
const WEBHOOK_SECRET = `sandbox-live-e2e-${randomUUID()}`;
const STRIP = ['MERCADO_PAGO_ACCESS_TOKEN', 'MP_ACCESS_TOKEN', 'MERCADO_PAGO_WEBHOOK_SECRET', 'MP_WEBHOOK_SECRET', 'STAGING_MP_ACCESS_TOKEN', 'STAGING_MP_CLIENT_SECRET', 'PROD_MP_MARKETPLACE_CLIENT_SECRET', 'MERCADO_PAGO_PUBLIC_KEY', 'NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY', 'MERCADO_PAGO_USER_ID', 'PUBLIC_API_URL', 'MERCADO_PAGO_API_BASE_URL', 'FINANCE_TEST_MODE'];

function assertLocalDb() {
  const url = process.env.DATABASE_URL || '';
  if (!url || /railway|rlwy|\.internal|prod/i.test(url) || !/127\.0\.0\.1|localhost/.test(url)) throw new Error('RECUSADO: DATABASE_URL deve ser local');
}
/** Direct sandbox call (test setup / out-of-band MP actions only). */
async function sandbox(method: string, path: string, body?: unknown) {
  if (!TOKEN.startsWith('TEST-')) throw new Error('sandbox token guard');
  const r = await fetch(`${MP}${path}`, { method, headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': `sch-sbx-live-${randomUUID()}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text();
  let j: any = null; try { j = t ? JSON.parse(t) : null; } catch { j = t; }
  return { status: r.status, json: j };
}
/** Official MP test cards (Brazil). */
const TEST_CARDS = [{ number: '5031433215406351', method: 'master' }, { number: '4235647728025682', method: 'visa' }] as const;
async function cardToken(holder: 'APRO' | 'OTHE' | 'CONT', card: (typeof TEST_CARDS)[number]) {
  // Tokenizing with the TEST access token (no TEST public key available) is flaky at MP: at times the token comes back
  // live_mode=true and the sandbox payment then fails with "Card Token not found" (2006). Only sandbox tokens are used.
  const cardBody = { card_number: card.number, security_code: '123', expiration_month: 11, expiration_year: 2030, cardholder: { name: holder, identification: { type: 'CPF', number: '12345678909' } } };
  for (let i = 0; i < 6; i++) {
    // Preferred: tokenize like the storefront Brick does — with the sandbox PUBLIC key (no bearer).
    const r = PUBLIC_KEY
      ? await (async () => {
          const res = await fetch(`${MP}/v1/card_tokens?public_key=${encodeURIComponent(PUBLIC_KEY)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cardBody) });
          return { status: res.status, json: await res.json().catch(() => null) as any };
        })()
      : await sandbox('POST', '/v1/card_tokens', cardBody);
    assert.equal(r.status, 201, `card_token ${r.status}`);
    if (r.json.live_mode === false) return String(r.json.id);
    await new Promise((res) => setTimeout(res, 2000));
  }
  throw new Error(`BLOCKED_EXTERNAL: MP sandbox só devolveu card tokens live_mode=true (${PUBLIC_KEY ? 'public key TEST-' : 'access token TEST-, sem MP_SANDBOX_PUBLIC_KEY'})`);
}

const results: { id: string; ok: boolean; blocked?: boolean }[] = [];
const observed: Record<string, unknown> = {};
async function scenario(id: string, name: string, fn: () => Promise<string | void>) {
  const t0 = Date.now();
  try { const d = await fn(); results.push({ id, ok: true }); console.log(`  PASS ${id} ${name}${d ? ' — ' + d : ''} (${Date.now() - t0}ms)`); }
  catch (e: any) {
    const blocked = String(e?.message || '').startsWith('BLOCKED_EXTERNAL') || /needs L02/.test(String(e?.message || '')) && results.some((r) => r.id === 'L02' && r.blocked);
    results.push({ id, ok: false, blocked });
    console.log(`  ${blocked ? 'BLOCKED_EXTERNAL' : 'FAIL'} ${id} ${name}\n${String(e?.stack || e).slice(0, blocked ? 300 : 1500)}`);
  }
}

async function main() {
  assertLocalDb();
  for (const k of STRIP) delete process.env[k];
  Object.assign(process.env, {
    APP_ENV: 'development', NODE_ENV: 'development', PAYMENTS_PROVIDER: 'mercadopago',
    MERCADO_PAGO_ACCESS_TOKEN: TOKEN, MERCADO_PAGO_WEBHOOK_SECRET: WEBHOOK_SECRET,
    FINANCE_REFUNDS_ENABLED: 'true', FINANCE_RECONCILIATION_CRON_ENABLED: 'false',
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'omega-sbx-access-secret-xxxxxxxxxx',
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'omega-sbx-refresh-secret-xxxxxxxxx',
    REFRESH_COOKIE_SECURE: 'false',
  });
  const me = await sandbox('GET', '/users/me');
  assert.equal(me.status, 200);
  console.log(`[REAL MP SANDBOX] account ${me.json.id} (${me.json.site_id}); token prefix TEST- verified`);
  console.log('compiling API with tsc…');
  compileApi();
  const srv = await bootHttpApp();
  const prisma = new PrismaClient({ log: ['error'] });
  const base = srv.base;

  let ipSeq = 1;
  const freshIp = () => `10.88.${Math.floor(ipSeq / 250)}.${(ipSeq++ % 250) + 1}`;
  async function http(method: string, path: string, opts: { cookie?: string; body?: unknown; headers?: Record<string, string>; rawQuery?: string } = {}) {
    const res = await fetch(`${base}${path}${opts.rawQuery ?? ''}`, { method, headers: { 'content-type': 'application/json', 'x-forwarded-for': freshIp(), ...(opts.cookie ? { cookie: opts.cookie } : {}), ...(opts.headers || {}) }, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
    const text = await res.text();
    let json: any = null; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    return { status: res.status, json };
  }
  async function login(email: string, password: string) {
    const r = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': freshIp() }, body: JSON.stringify({ email, password }) });
    assert.equal(r.status, 201);
    return r.headers.getSetCookie().map((c) => c.split(';')[0]).filter((c) => /^sch_(access|refresh)=/.test(c)).join('; ');
  }
  const seller = await prisma.seller.upsert({ where: { slug: 'lojas-schimitz' }, update: {}, create: { id: '00000000-0000-4000-8000-000000000001', name: 'Lojas Schimitz', slug: 'lojas-schimitz', status: 'active' } });
  async function user(role: 'customer' | 'admin') {
    // MP validates payer.email: example.com is reserved (RFC 2606) and accepted by the sandbox.
    const email = `sbx-${role}-${randomUUID().slice(0, 8)}@example.com`;
    const password = 'Omega-sbx-Pass-123';
    const u = await prisma.user.create({ data: { email, passwordHash: await argon2.hash(password), name: `SBX ${role}`, role, status: 'active', phone: '51999999999' } });
    const a = await prisma.address.create({ data: { userId: u.id, label: 'Casa', cep: '91250000', street: 'Rua Teste', number: '1', district: 'Centro', city: 'Porto Alegre', uf: 'RS' } });
    return { user: u, address: a, cookie: await login(email, password) };
  }
  async function product(qty: number, price = 100) {
    const sku = `OMEGA-SBX-${randomUUID().slice(0, 8)}`;
    return prisma.product.create({ data: { sku, name: `SBX ${sku}`, slug: sku.toLowerCase(), description: 'omega sandbox test product', price, active: true, sellerId: seller.id, inventory: { create: { qtyOnHand: qty, qtyReserved: 0 } } } });
  }
  async function checkout(b: { cookie: string; address: { id: string } }, productId: string) {
    assert.ok([200, 201].includes((await http('POST', '/cart/items', { cookie: b.cookie, body: { productId, qty: 1 } })).status));
    const o = await http('POST', '/orders', { cookie: b.cookie, body: { addressId: b.address.id }, headers: { 'idempotency-key': `sbx-order-${randomUUID()}` } });
    assert.equal(o.status, 201, JSON.stringify(o.json));
    return o.json.data;
  }
  const oid = (o: any) => o.id ?? o.order?.id;
  async function pixIntent(cookie: string, orderId: string) {
    const r = await http('POST', '/payments/intents', { cookie, headers: { 'idempotency-key': `sbx-intent-${randomUUID()}` }, body: { orderId, method: 'pix' } });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    return r.json.data.payment as { id: string; externalId: string; status: string };
  }
  /** Card intent with a fresh sandbox card token. The sandbox intermittently answers "Card Token not found" (2006) → retry with a new token. */
  async function cardIntent(cookie: string, orderId: string, holder: 'APRO' | 'OTHE' | 'CONT') {
    let last: any;
    for (let i = 0; i < 6; i++) {
      const card = TEST_CARDS[i % TEST_CARDS.length];
      const r = await http('POST', '/payments/intents', { cookie, headers: { 'idempotency-key': `sbx-card-${randomUUID()}` }, body: { orderId, method: 'card', cardToken: await cardToken(holder, card), installments: 1, paymentMethodId: card.method } });
      last = r;
      if (r.status === 201) return { attempts: i + 1, payment: r.json.data.payment as { id: string; externalId: string; status: string } };
      await new Promise((res) => setTimeout(res, 1000 + 250 * i));
    }
    throw new Error(`card intent failed after retries: ${last.status} ${JSON.stringify(last.json).slice(0, 300)}`);
  }
  function signed(dataId: string, requestId: string = randomUUID(), secret: string = WEBHOOK_SECRET) {
    const ts = String(Math.floor(Date.now() / 1000));
    const v1 = createHmac('sha256', secret).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest('hex');
    return { headers: { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': requestId }, body: { action: 'payment.updated', api_version: 'v1', data: { id: dataId }, date_created: new Date().toISOString(), id: Math.floor(Math.random() * 1e12), live_mode: false, type: 'payment', user_id: String(me.json.id) }, rawQuery: `?data.id=${encodeURIComponent(dataId)}&type=payment` };
  }
  const webhook = (dataId: string, requestId?: string, secret?: string) => { const w = signed(dataId, requestId, secret); return http('POST', '/webhooks/mercadopago', { headers: w.headers, body: w.body, rawQuery: w.rawQuery }); };
  const inv = (productId: string) => prisma.inventory.findUniqueOrThrow({ where: { productId } });
  const pay = (id: string) => prisma.payment.findUniqueOrThrow({ where: { id } });
  const ledger = (paymentId: string) => prisma.financialLedgerEntry.findMany({ where: { paymentId }, orderBy: { createdAt: 'asc' } });
  const mpPay = async (externalId: string) => { const r = await sandbox('GET', `/v1/payments/${externalId}`); assert.equal(r.status, 200); assert.equal(r.json.live_mode, false, 'must be sandbox'); return r.json; };

  const admin = await user('admin');
  let approved: { id: string; externalId: string; productId: string; orderId: string; amount: number } | null = null;
  console.log('Scenarios (REAL MP SANDBOX):');

  await scenario('L01', 'PIX real sandbox: intent → pending + QR; webhook (fetch-by-id) mantém PENDING; estorno recusado localmente', async () => {
    const b = await user('customer'); const p = await product(3);
    const order = await checkout(b, p.id);
    const ip = await pixIntent(b.cookie, oid(order));
    const remote = await mpPay(ip.externalId);
    observed.pix = { status: remote.status, status_detail: remote.status_detail, payment_type_id: remote.payment_type_id, has_qr: !!remote.point_of_interaction?.transaction_data?.qr_code, external_reference_matches: remote.external_reference === order.publicId, amount: remote.transaction_amount };
    assert.equal(remote.status, 'pending'); assert.equal(remote.external_reference, order.publicId);
    const row = await pay(ip.id);
    assert.equal(Number(row.amount), remote.transaction_amount);
    assert.ok((row.payload as any)?.qrCode, 'QR persisted');
    assert.equal((await webhook(ip.externalId)).status, 200);
    const after = await pay(ip.id);
    assert.equal(after.status, 'pending'); assert.equal(after.financialState, 'PENDING');
    assert.equal(await prisma.inventoryMovement.count({ where: { orderId: oid(order), kind: 'COMMIT' } }), 0);
    const rf = await http('POST', `/admin/finance/payments/${ip.id}/refunds`, { cookie: admin.cookie, headers: { 'idempotency-key': `sbx-rf-${randomUUID()}` }, body: { reason: 'estorno de PIX pendente deve falhar', confirm: true } });
    assert.ok(rf.status >= 400 && rf.status < 500, `refund on pending → ${rf.status}`);
    // MP-side cancellation (what expiry/cancel does at MP) + notification → CANCELLED locally.
    const c = await sandbox('PUT', `/v1/payments/${ip.externalId}`, { status: 'cancelled' });
    assert.equal(c.status, 200); assert.equal(c.json.status, 'cancelled');
    assert.equal((await webhook(ip.externalId)).status, 200);
    const cancelled = await pay(ip.id);
    assert.equal(cancelled.status, 'cancelled'); assert.equal(cancelled.financialState, 'CANCELLED');
    const i = await inv(p.id);
    observed.pixCancelInventory = { qtyOnHand: i.qtyOnHand, qtyReserved: i.qtyReserved };
    return `MP ${ip.externalId}: pending/${remote.status_detail} → cancelled/${c.json.status_detail}; local CANCELLED; reserved=${i.qtyReserved}`;
  });

  await scenario('L02', 'Cartão APRO real: approved/accredited → webhook → PAID, 1 commit, 1 capture; 3 entregas idempotentes', async () => {
    const b = await user('customer'); const p = await product(3);
    const order = await checkout(b, p.id);
    const { payment: ci, attempts } = await cardIntent(b.cookie, oid(order), 'APRO');
    const remote = await mpPay(ci.externalId);
    observed.cardApproved = { status: remote.status, status_detail: remote.status_detail, captured: remote.captured, attempts };
    assert.equal(remote.status, 'approved');
    const reqId = randomUUID();
    for (const r of [reqId, reqId, undefined]) assert.equal((await webhook(ci.externalId, r)).status, 200);
    const row = await pay(ci.id);
    assert.equal(row.status, 'approved'); assert.equal(row.financialState, 'PAID');
    assert.equal(await prisma.inventoryMovement.count({ where: { orderId: oid(order), kind: 'COMMIT' } }), 1);
    const l = await ledger(ci.id);
    assert.equal(l.filter((x) => x.entryType === 'PAYMENT_CAPTURED').length, 1);
    assert.equal((await inv(p.id)).qtyOnHand, 2);
    approved = { id: ci.id, externalId: ci.externalId, productId: p.id, orderId: oid(order), amount: Number(row.amount) };
    return `MP ${ci.externalId} approved/${remote.status_detail} (token attempts=${attempts}); PAID; onHand 3→2`;
  });

  await scenario('L03', 'Estorno PARCIAL real (R$ 30,00): MP refund approved → COMPLETED, PARTIALLY_REFUNDED; replay idempotente; chave reusada c/ outro valor → 409', async () => {
    assert.ok(approved, 'needs L02');
    const key = `sbx-partial-${randomUUID()}`;
    const body = { amount: 30, reason: 'estorno parcial sandbox real', confirm: true };
    const r = await http('POST', `/admin/finance/payments/${approved!.id}/refunds`, { cookie: admin.cookie, headers: { 'idempotency-key': key }, body });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    const refund = r.json.data.refund;
    assert.equal(refund.status, 'COMPLETED', JSON.stringify(refund));
    assert.equal(refund.providerStatus, 'approved');
    const again = await http('POST', `/admin/finance/payments/${approved!.id}/refunds`, { cookie: admin.cookie, headers: { 'idempotency-key': key }, body });
    assert.equal(again.status, 201); assert.equal(again.json.data.idempotent, true); assert.equal(again.json.data.refund.id, refund.id);
    const conflict = await http('POST', `/admin/finance/payments/${approved!.id}/refunds`, { cookie: admin.cookie, headers: { 'idempotency-key': key }, body: { ...body, amount: 10 } });
    assert.equal(conflict.status, 409);
    const remote = await mpPay(approved!.externalId);
    observed.partial = { status: remote.status, status_detail: remote.status_detail, transaction_amount_refunded: remote.transaction_amount_refunded, refunds: (remote.refunds || []).map((x: any) => ({ status: x.status, amount: x.amount })) };
    assert.equal(remote.status, 'approved'); assert.equal(remote.status_detail, 'partially_refunded'); assert.equal(remote.transaction_amount_refunded, 30);
    assert.equal((remote.refunds || []).length, 1, 'exactly one MP refund despite replay');
    assert.equal((await webhook(approved!.externalId)).status, 200);
    const row = await pay(approved!.id);
    assert.equal(row.financialState, 'PARTIALLY_REFUNDED');
    const done = (await ledger(approved!.id)).filter((x) => x.entryType === 'REFUND_COMPLETED');
    assert.equal(done.length, 1); assert.equal(Number(done[0].amount), 30);
    return `MP approved/partially_refunded, refunded=30; 1 MP refund; ledger REFUND_COMPLETED 30`;
  });

  await scenario('L04', 'listRefunds contra o sandbox real (405 → fallback payment.refunds[])', async () => {
    assert.ok(approved, 'needs L02');
    const direct = await sandbox('GET', `/v1/payments/${approved!.externalId}/refunds`);
    observed.listRefundsEndpoint = direct.status;
    const { MercadoPagoPaymentProvider } = require('../payments/payment.provider');
    const rows = await new MercadoPagoPaymentProvider().listRefunds(approved!.externalId);
    assert.equal(rows.length, 1); assert.equal(rows[0].status, 'approved'); assert.equal(rows[0].amount, 30);
    return `GET /refunds → HTTP ${direct.status}; adapter returned ${rows.length} refund(s)`;
  });

  await scenario('L05', 'Estorno do SALDO real (sem amount): REFUNDED, restock 1x; webhook mantém REFUNDED; MP refunded == valor pago', async () => {
    assert.ok(approved, 'needs L02');
    const r = await http('POST', `/admin/finance/payments/${approved!.id}/refunds`, { cookie: admin.cookie, headers: { 'idempotency-key': `sbx-rest-${randomUUID()}` }, body: { reason: 'estorno do saldo sandbox real', confirm: true } });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.equal(r.json.data.refund.status, 'COMPLETED');
    assert.equal(Number(r.json.data.refund.amount), Math.round((approved!.amount - 30) * 100) / 100);
    const remote = await mpPay(approved!.externalId);
    observed.full = { status: remote.status, status_detail: remote.status_detail, transaction_amount_refunded: remote.transaction_amount_refunded, refunds: (remote.refunds || []).length };
    assert.equal(remote.status, 'refunded'); assert.equal(remote.transaction_amount_refunded, approved!.amount);
    assert.equal((await webhook(approved!.externalId)).status, 200);
    assert.equal((await webhook(approved!.externalId)).status, 200);
    const row = await pay(approved!.id);
    assert.equal(row.financialState, 'REFUNDED');
    const done = (await ledger(approved!.id)).filter((x) => x.entryType === 'REFUND_COMPLETED');
    assert.equal(done.length, 2);
    assert.equal(done.reduce((s, x) => s + Number(x.amount), 0), approved!.amount);
    const restocks = await prisma.inventoryMovement.count({ where: { orderId: approved!.orderId, kind: 'RESTOCK' } });
    const i = await inv(approved!.productId);
    observed.fullInventory = { qtyOnHand: i.qtyOnHand, restockMovements: restocks };
    return `MP refunded/${remote.status_detail} (${remote.refunds.length} refunds); ledger 2× REFUND_COMPLETED = ${approved!.amount}; onHand=${i.qtyOnHand}`;
  });

  await scenario('L06', 'Cartão OTHE real: rejected/cc_rejected_other_reason → refused/FAILED, sem captura/baixa', async () => {
    const b = await user('customer'); const p = await product(2);
    const order = await checkout(b, p.id);
    const { payment: ci } = await cardIntent(b.cookie, oid(order), 'OTHE');
    const remote = await mpPay(ci.externalId);
    observed.rejected = { status: remote.status, status_detail: remote.status_detail };
    assert.equal(remote.status, 'rejected');
    assert.equal((await webhook(ci.externalId)).status, 200);
    const row = await pay(ci.id);
    assert.equal(row.status, 'refused'); assert.equal(row.financialState, 'FAILED');
    assert.ok(!(await ledger(ci.id)).some((x) => x.entryType === 'PAYMENT_CAPTURED'));
    assert.equal((await inv(p.id)).qtyOnHand, 2);
    return `MP rejected/${remote.status_detail}; FAILED`;
  });

  await scenario('L07', 'Cartão CONT real: in_process/pending_contingency → pending/PENDING (sem captura)', async () => {
    const b = await user('customer'); const p = await product(2);
    const order = await checkout(b, p.id);
    const { payment: ci } = await cardIntent(b.cookie, oid(order), 'CONT');
    const remote = await mpPay(ci.externalId);
    observed.contingency = { status: remote.status, status_detail: remote.status_detail };
    assert.equal(remote.status, 'in_process');
    assert.equal((await webhook(ci.externalId)).status, 200);
    const row = await pay(ci.id);
    assert.equal(row.status, 'pending'); assert.equal(row.financialState, 'PENDING');
    assert.ok(!(await ledger(ci.id)).some((x) => x.entryType === 'PAYMENT_CAPTURED'));
    return `MP in_process/${remote.status_detail}; PENDING`;
  });

  await scenario('L08', 'Reconciliação (admin) do pagamento estornado contra o sandbox real → sem divergência aberta', async () => {
    assert.ok(approved, 'needs L02');
    const r = await http('POST', '/admin/finance/reconcile', { cookie: admin.cookie, body: { scope: 'PAYMENT', paymentId: approved!.id, reason: 'conferência sandbox real', confirm: true } });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    const open = await prisma.financialDiscrepancy.findMany({ where: { paymentId: approved!.id, status: { not: 'RESOLVED' }, conditionCleared: false } });
    assert.equal(open.length, 0, JSON.stringify(open.map((d) => [d.type, d.message])));
    return `reconcile ${r.json.data?.status ?? 'ok'}; 0 open discrepancies`;
  });

  await scenario('L09', 'Webhook com assinatura errada para id real → 401, nada muda', async () => {
    assert.ok(approved, 'needs L02');
    const before = await pay(approved!.id);
    const w = await webhook(approved!.externalId, undefined, 'wrong-secret-wrong-secret-wrong-secret');
    assert.equal(w.status, 401);
    const after = await pay(approved!.id);
    assert.equal(after.updatedAt.getTime(), before.updatedAt.getTime());
    return '401';
  });

  console.log('\nOBSERVED (real sandbox):', JSON.stringify(observed));
  await prisma.product.updateMany({ where: { sku: { startsWith: 'OMEGA-SBX-' } }, data: { active: false } });
  await srv.close();
  await prisma.$disconnect();
  const passed = results.filter((r) => r.ok).length;
  const blocked = results.filter((r) => r.blocked).length;
  const failed = results.length - passed - blocked;
  console.log(`\nfinance.mp-sandbox.live.spec: ${passed} PASS / ${failed} FAIL / ${blocked} BLOCKED_EXTERNAL (REAL MP SANDBOX, live_mode=false)`);
  process.exit(failed ? 1 : blocked ? 3 : 0);
}
main().catch((e) => { console.error('finance.mp-sandbox.live.spec FATAL', e); process.exit(1); });
