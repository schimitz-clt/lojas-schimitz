/**
 * COMANDO OMEGA — financial core integration tests.
 *  - Real Nest DI, real PaymentsService/OrdersService/RefundsService/ReconciliationService.
 *  - Real LOCAL Postgres only (refuses Railway / non-localhost URLs).
 *  - Real MercadoPago HTTP adapter pointed at a LOCAL FAKE server labelled TEST
 *    (testing/fake-mercadopago.server.ts). Token "TEST-FAKE-LOCAL". FINANCE_TEST_MODE=true blocks
 *    any request to api.mercadopago.com. No real credentials, no real charges, no real refunds.
 */
import assert from 'assert';
import { createHmac, randomUUID } from 'crypto';
import * as argon2 from 'argon2';
import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { FakeMercadoPagoServer } from './testing/fake-mercadopago.server';

const WEBHOOK_SECRET = 'fake-local-test-webhook-secret-0123456789';

function assertLocalDb() {
  const url = process.env.DATABASE_URL || '';
  if (!url) throw new Error('DATABASE_URL obrigatória');
  if (/railway|rlwy|\.internal|prod/i.test(url)) throw new Error('RECUSADO: DATABASE_URL parece produção');
  if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error('RECUSADO: DATABASE_URL deve ser local');
}

const fake = new FakeMercadoPagoServer();
const results: { id: string; name: string; ok: boolean; detail?: string }[] = [];
async function scenario(id: string, name: string, fn: () => Promise<string | void>) {
  const t0 = Date.now();
  try {
    const detail = await fn();
    results.push({ id, name, ok: true, detail: `${detail ?? ''} (${Date.now() - t0}ms)`.trim() });
    console.log(`  PASS ${id} ${name}${detail ? ' — ' + detail : ''}`);
  } catch (e: any) {
    results.push({ id, name, ok: false, detail: String(e?.stack || e).slice(0, 800) });
    console.log(`  FAIL ${id} ${name}\n${String(e?.stack || e).slice(0, 1200)}`);
  }
}
const code = (e: any) => e?.response?.code || e?.getResponse?.()?.code || e?.code;

async function main() {
  assertLocalDb();
  // Never let real credentials reach this process.
  for (const k of ['MP_ACCESS_TOKEN', 'MP_WEBHOOK_SECRET', 'STAGING_MP_ACCESS_TOKEN', 'PUBLIC_API_URL']) delete process.env[k];
  await fake.start();
  Object.assign(process.env, {
    APP_ENV: 'development',
    NODE_ENV: 'development',
    PAYMENTS_PROVIDER: 'mercadopago',
    MERCADO_PAGO_ACCESS_TOKEN: 'TEST-FAKE-LOCAL',
    MERCADO_PAGO_WEBHOOK_SECRET: WEBHOOK_SECRET,
    MERCADO_PAGO_API_BASE_URL: fake.baseUrl,
    MERCADO_PAGO_USER_ID: 'TEST-FAKE-CALLER',
    FINANCE_TEST_MODE: 'true',
    FINANCE_REFUNDS_ENABLED: 'true',
    FINANCE_RECONCILIATION_CRON_ENABLED: 'false',
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'omega-test-access-secret-xxxxxxxx',
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'omega-test-refresh-secret-xxxxxxx',
  });
  console.log(`[${fake.label}] listening at ${fake.baseUrl}`);

  // Import after env is set (provider reads base URL at construction).
  const { AppModule } = await import('../../app.module');
  const { PrismaService } = await import('../../prisma.service');
  const { PaymentsService } = await import('../payments/payments.service');
  const { OrdersService } = await import('../orders/orders.service');
  const { RefundsService } = await import('./refunds.service');
  const { ReconciliationService } = await import('./reconciliation.service');
  const { FinanceAdminService } = await import('./finance-admin.service');

  const app: INestApplicationContext = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const payments = app.get(PaymentsService);
  const orders = app.get(OrdersService);
  const refunds = app.get(RefundsService);
  const recon = app.get(ReconciliationService);
  const admin = app.get(FinanceAdminService);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "SchedulerLock" ("id" TEXT PRIMARY KEY, "holder" TEXT NOT NULL, "expiresAt" TIMESTAMPTZ NOT NULL)`);

  const adminUser = await prisma.user.create({
    data: { email: `omega-admin-${randomUUID().slice(0, 8)}@test.local`, passwordHash: 'x', name: 'Omega Admin', role: 'admin' },
  });
  const seller = await prisma.seller.upsert({
    where: { slug: 'lojas-schimitz' },
    update: {},
    create: { id: '00000000-0000-4000-8000-000000000001', name: 'Lojas Schimitz', slug: 'lojas-schimitz', status: 'active' },
  });

  async function buyer(tag: string) {
    const user = await prisma.user.create({
      data: { email: `omega-${tag}-${randomUUID().slice(0, 8)}@test.local`, passwordHash: await argon2.hash('omega-test-pass'), name: `Omega ${tag}`, role: 'customer', status: 'active', phone: '51999999999' },
    });
    const address = await prisma.address.create({
      data: { userId: user.id, label: 'Casa', cep: '91250000', street: 'Rua Teste', number: '1', district: 'Centro', city: 'Porto Alegre', uf: 'RS' },
    });
    return { user, address };
  }
  async function product(qty: number, price = 100) {
    const sku = `OMEGA-${randomUUID().slice(0, 8)}`;
    return prisma.product.create({
      data: { sku, name: `Omega test ${sku}`, slug: sku.toLowerCase(), description: 'omega financial test product', price, active: true, sellerId: seller.id, inventory: { create: { qtyOnHand: qty, qtyReserved: 0 } } },
    });
  }
  /** Real checkout: cart → OrdersService.create (reserve stock in the same transaction). */
  async function checkout(qty = 1, stock = 5, price = 100) {
    const b = await buyer('buyer');
    const p = await product(stock, price);
    const cart = await prisma.cart.create({ data: { userId: b.user.id } });
    await prisma.cartItem.create({ data: { cartId: cart.id, productId: p.id, qty } });
    const created: any = await orders.create(b.user.id, { addressId: b.address.id } as any, `omega-order-${randomUUID()}`);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: created.id ?? created.order?.id }, include: { items: true } });
    return { ...b, product: p, order };
  }
  async function intent(userId: string, orderId: string, method: 'pix' | 'card', key = `omega-intent-${randomUUID()}`) {
    const r: any = await payments.createIntent(userId, { orderId, method, ...(method === 'card' ? { cardToken: 'TEST-FAKE-CARD-TOKEN-0001', installments: 1, paymentMethodId: 'visa' } : {}) } as any, key);
    return r.payment as { id: string; externalId: string; status: string; amount: number };
  }
  function signed(dataId: string, requestId: string = randomUUID(), type = 'payment', extraBody: Record<string, unknown> = {}) {
    const ts = String(Math.floor(Date.now() / 1000));
    const v1 = createHmac('sha256', WEBHOOK_SECRET).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest('hex');
    return {
      headers: { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': requestId },
      body: { id: Math.floor(Math.random() * 1e12), type, action: `${type}.updated`, data: { id: dataId }, ...extraBody },
      query: { 'data.id': dataId, type },
    };
  }
  const webhook = (dataId: string, requestId?: string, type?: string, extra?: Record<string, unknown>) => {
    const s = signed(dataId, requestId, type, extra);
    return payments.handleWebhook(s.headers as any, s.body, s.query);
  };
  const inv = (productId: string) => prisma.inventory.findUniqueOrThrow({ where: { productId } });
  const ledger = (paymentId: string) => prisma.financialLedgerEntry.findMany({ where: { paymentId }, orderBy: { createdAt: 'asc' } });
  const types = (rows: { entryType: string }[]) => rows.map((r) => r.entryType).sort();
  const pay = (id: string) => prisma.payment.findUniqueOrThrow({ where: { id } });
  const moves = (orderId: string) => prisma.inventoryMovement.findMany({ where: { orderId } });
  const discrepancies = (where: any) => prisma.financialDiscrepancy.findMany({ where });

  console.log('Scenarios:');

  // ---------------------------------------------------------------- PIX
  await scenario('S01', 'PIX aprovado (webhook → pedido pago, ledger, baixa de estoque 1x)', async () => {
    const c = await checkout(2, 5);
    assert.equal((await inv(c.product.id)).qtyReserved, 2);
    const p = await intent(c.user.id, c.order.id, 'pix');
    assert.equal(p.status, 'pending');
    fake.setPayment(p.externalId, { status: 'approved', status_detail: 'accredited' });
    const r: any = await webhook(p.externalId);
    assert.equal(r.applied, true);
    const row = await pay(p.id);
    assert.equal(row.status, 'approved');
    assert.equal(row.financialState, 'PAID');
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: c.order.id } })).status, 'paid');
    assert.deepEqual(types(await ledger(p.id)), ['PAYMENT_CAPTURED', 'PAYMENT_CREATED']);
    const i = await inv(c.product.id);
    assert.equal(i.qtyOnHand, 3);
    assert.equal(i.qtyReserved, 0);
    const m = (await moves(c.order.id)).map((x) => x.kind).sort();
    assert.deepEqual(m, ['COMMIT', 'RESERVE']);
    const tr = await prisma.paymentStateTransition.findMany({ where: { paymentId: p.id }, orderBy: { createdAt: 'asc' } });
    assert.deepEqual(tr.map((x) => `${x.fromState ?? '∅'}>${x.toState}`), ['∅>PENDING', 'PENDING>PAID']);
    return `onHand 5→3, reserved 2→0, ledger=${types(await ledger(p.id)).join('+')}`;
  });

  await scenario('S02', 'PIX expirado (sem captura, sem baixa)', async () => {
    const c = await checkout(1, 5);
    const p = await intent(c.user.id, c.order.id, 'pix');
    fake.setPayment(p.externalId, { status: 'expired', status_detail: 'expired' });
    await webhook(p.externalId);
    const row = await pay(p.id);
    assert.equal(row.status, 'expired');
    assert.equal(row.financialState, 'EXPIRED');
    assert.equal((await ledger(p.id)).some((l) => l.entryType === 'PAYMENT_CAPTURED'), false);
    assert.equal((await moves(c.order.id)).some((m) => m.kind === 'COMMIT'), false);
    const o = await prisma.order.findUniqueOrThrow({ where: { id: c.order.id } });
    return `order=${o.status}`;
  });

  await scenario('S03', 'PIX webhook duplicado (mesmo x-request-id) → processa 1x', async () => {
    const c = await checkout(1, 5);
    const p = await intent(c.user.id, c.order.id, 'pix');
    fake.setPayment(p.externalId, { status: 'approved', status_detail: 'accredited' });
    const reqId = randomUUID();
    await webhook(p.externalId, reqId);
    const second: any = await webhook(p.externalId, reqId);
    const ev = await prisma.paymentEvent.findFirstOrThrow({ where: { providerEventId: reqId } });
    assert.equal(ev.attempts, 2);
    assert.equal((await prisma.paymentStateTransition.count({ where: { paymentId: p.id, toState: 'PAID' } })), 1);
    assert.equal((await moves(c.order.id)).filter((m) => m.kind === 'COMMIT').length, 1);
    return `second=${JSON.stringify(second).slice(0, 80)}`;
  });

  // ---------------------------------------------------------------- CARD
  await scenario('S04', 'Cartão aprovado na criação (Brick token) → pago', async () => {
    const c = await checkout(1, 5);
    fake.nextCardStatus = { status: 'approved', status_detail: 'accredited' };
    const p = await intent(c.user.id, c.order.id, 'card');
    const row = await pay(p.id);
    assert.equal(row.status, 'approved');
    assert.equal(row.financialState, 'PAID');
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: c.order.id } })).status, 'paid');
    const call = fake.calls.find((x) => x.method === 'POST' && x.path === '/v1/payments' && x.idem === `sch-${p.id}`);
    assert.ok(call, 'X-Idempotency-Key sch-<paymentId> sent to provider');
  });

  await scenario('S05', 'Cartão recusado → FAILED, ledger PAYMENT_FAILED, pedido segue aguardando', async () => {
    const c = await checkout(1, 5);
    fake.nextCardStatus = { status: 'rejected', status_detail: 'cc_rejected_other_reason' };
    const p = await intent(c.user.id, c.order.id, 'card').catch((e) => { throw new Error(`intent threw ${code(e)}`); });
    const row = await pay(p.id);
    assert.equal(row.status, 'refused');
    assert.equal(row.financialState, 'FAILED');
    assert.ok(types(await ledger(p.id)).includes('PAYMENT_FAILED'));
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: c.order.id } })).status, 'awaiting_payment');
    fake.nextCardStatus = { status: 'approved', status_detail: 'accredited' };
  });

  await scenario('S06', 'Cartão pendente (in_process) → PENDING, sem captura', async () => {
    const c = await checkout(1, 5);
    fake.nextCardStatus = { status: 'in_process', status_detail: 'pending_contingency' };
    const p = await intent(c.user.id, c.order.id, 'card');
    const row = await pay(p.id);
    assert.equal(row.status, 'pending');
    assert.equal(row.financialState, 'PENDING');
    assert.equal(types(await ledger(p.id)).includes('PAYMENT_CAPTURED'), false);
    fake.nextCardStatus = { status: 'approved', status_detail: 'accredited' };
  });

  // ---------------------------------------------------------------- ORDERING / INTEGRITY
  await scenario('S07', 'Webhook fora de ordem: evento antigo depois do novo não regride (re-fetch no MP)', async () => {
    const c = await checkout(1, 5);
    const p = await intent(c.user.id, c.order.id, 'pix');
    fake.setPayment(p.externalId, { status: 'approved', status_detail: 'accredited' });
    await webhook(p.externalId, undefined, 'payment', { action: 'payment.updated' });
    // late "payment.created" (older) notification arrives afterwards; body says nothing trusted
    await webhook(p.externalId, undefined, 'payment', { action: 'payment.created' });
    assert.equal((await pay(p.id)).financialState, 'PAID');
    assert.equal((await prisma.paymentStateTransition.count({ where: { paymentId: p.id } })), 2);
  });

  await scenario('S08', 'Transição proibida REFUNDED→PAID (MP devolve dado velho) é bloqueada + auditada', async () => {
    const c = await checkout(1, 5);
    const p = await intent(c.user.id, c.order.id, 'pix');
    fake.setPayment(p.externalId, { status: 'approved', status_detail: 'accredited' });
    await webhook(p.externalId);
    await refunds.requestRefund({ paymentId: p.id, reason: 'teste estorno total cenário S08', idempotencyKey: `omega-s08-${randomUUID()}`, actorId: adminUser.id });
    assert.equal((await pay(p.id)).financialState, 'REFUNDED');
    fake.setPayment(p.externalId, { status: 'approved', status_detail: 'accredited', transaction_amount_refunded: 0 }); // stale/inconsistent provider answer
    const r: any = await webhook(p.externalId);
    const row = await pay(p.id);
    assert.equal(row.status, 'refunded');
    assert.equal(row.financialState, 'REFUNDED');
    const d = await discrepancies({ paymentId: p.id, type: 'FORBIDDEN_TRANSITION' });
    assert.equal(d.length, 1);
    return `webhook reason=${r.reason}`;
  });

  await scenario('S09', 'Pagamento sem pedido (órfão) → fila de reconciliação + discrepância CRÍTICA', async () => {
    const orphan = fake.addPayment({ transaction_amount: 55, status: 'approved', status_detail: 'accredited', external_reference: 'SCH-DOES-NOT-EXIST' });
    const r: any = await webhook(orphan.id);
    assert.equal(r.applied, false);
    const d = await discrepancies({ externalId: orphan.id, type: 'PAYMENT_WITHOUT_ORDER' });
    assert.equal(d.length, 1);
    assert.equal(d[0].severity, 'CRITICAL');
    assert.ok(await prisma.paymentReconciliation.findFirst({ where: { externalId: orphan.id } }));
  });

  await scenario('S10', 'Pedido pago sem pagamento → reconciliação detecta CRÍTICA', async () => {
    const c = await checkout(1, 5);
    await prisma.order.update({ where: { id: c.order.id }, data: { status: 'paid', reservationExpiresAt: null } });
    const run = await recon.run({ scope: 'ORDER', orderId: c.order.id, origin: 'test', withProvider: false });
    assert.equal(run.status, 'COMPLETED');
    const d = await discrepancies({ orderId: c.order.id, type: 'ORDER_PAID_WITHOUT_PAYMENT' });
    assert.equal(d.length, 1);
    assert.equal(d[0].severity, 'CRITICAL');
  });

  await scenario('S11', 'Valor divergente (MP ≠ local) → não marca pago, reconciliação', async () => {
    const c = await checkout(1, 5);
    const p = await intent(c.user.id, c.order.id, 'pix');
    fake.setPayment(p.externalId, { status: 'approved', status_detail: 'accredited', transaction_amount: 1 });
    const r: any = await webhook(p.externalId);
    assert.equal(r.applied, false);
    assert.equal((await pay(p.id)).status, 'pending');
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: c.order.id } })).status, 'awaiting_payment');
    await recon.run({ scope: 'PAYMENT', paymentId: p.id, origin: 'test' });
    const d = await discrepancies({ paymentId: p.id, type: 'AMOUNT_MISMATCH' });
    assert.equal(d[0]?.severity, 'CRITICAL');
    return `reason=${r.reason}`;
  });

  // ---------------------------------------------------------------- REFUNDS
  async function paidOrder(stock = 5, price = 100) {
    const c = await checkout(1, stock, price);
    const p = await intent(c.user.id, c.order.id, 'pix');
    fake.setPayment(p.externalId, { status: 'approved', status_detail: 'accredited' });
    await webhook(p.externalId);
    return { ...c, payment: await pay(p.id) };
  }

  await scenario('S12', 'Estorno total → REFUNDED, pedido refunded, estoque devolvido 1x, ledger', async () => {
    const c = await paidOrder(5);
    const before = await inv(c.product.id);
    const r: any = await refunds.requestRefund({ paymentId: c.payment.id, reason: 'cliente desistiu — teste S12', idempotencyKey: `omega-s12-${randomUUID()}`, actorId: adminUser.id });
    assert.equal(r.refund.status, 'COMPLETED');
    const row = await pay(c.payment.id);
    assert.equal(row.status, 'refunded');
    assert.equal(row.financialState, 'REFUNDED');
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: c.order.id } })).status, 'refunded');
    assert.equal((await inv(c.product.id)).qtyOnHand, before.qtyOnHand + 1);
    const l = types(await ledger(c.payment.id));
    assert.deepEqual(l, ['PAYMENT_CAPTURED', 'PAYMENT_CREATED', 'REFUND_COMPLETED', 'REFUND_CREATED']);
    assert.equal((await moves(c.order.id)).filter((m) => m.kind === 'RESTOCK').length, 1);
    // late webhook after refund must not double-count the refund in the ledger
    await webhook(c.payment.externalId!);
    assert.equal((await ledger(c.payment.id)).filter((x) => x.entryType === 'REFUND_COMPLETED').length, 1);
    return `ledger=${l.join('+')}`;
  });

  await scenario('S13', 'Estorno parcial → PARTIALLY_REFUNDED; acima do saldo é recusado', async () => {
    const c = await paidOrder(5);
    const amount = Number(c.payment.amount);
    const r: any = await refunds.requestRefund({ paymentId: c.payment.id, amount: 10, reason: 'devolução parcial teste S13', idempotencyKey: `omega-s13a-${randomUUID()}`, actorId: adminUser.id });
    assert.equal(r.refund.status, 'COMPLETED');
    assert.equal((await pay(c.payment.id)).financialState, 'PARTIALLY_REFUNDED');
    await assert.rejects(
      () => refunds.requestRefund({ paymentId: c.payment.id, amount: amount, reason: 'excede o saldo teste S13', idempotencyKey: `omega-s13b-${randomUUID()}`, actorId: adminUser.id }),
      (e: any) => code(e) === 'REFUND_EXCEEDS_PAID',
    );
    const r2: any = await refunds.requestRefund({ paymentId: c.payment.id, reason: 'restante do saldo teste S13', idempotencyKey: `omega-s13c-${randomUUID()}`, actorId: adminUser.id });
    assert.equal(Number(r2.refund.amount), Math.round((amount - 10) * 100) / 100);
    assert.equal((await pay(c.payment.id)).financialState, 'REFUNDED');
    const debits = (await ledger(c.payment.id)).filter((x) => x.entryType === 'REFUND_COMPLETED').reduce((s, x) => s + Number(x.amount), 0);
    assert.equal(Math.round(debits * 100) / 100, amount);
    return `paid=${amount} refunded 10 + ${amount - 10}`;
  });

  await scenario('S14', 'Estorno duplicado (mesma Idempotency-Key) → 1 estorno, 1 chamada ao provedor', async () => {
    const c = await paidOrder(5);
    const key = `omega-s14-${randomUUID()}`;
    const before = fake.count('POST', /\/refunds$/);
    const a: any = await refunds.requestRefund({ paymentId: c.payment.id, amount: 5, reason: 'duplicado teste S14', idempotencyKey: key, actorId: adminUser.id });
    const b: any = await refunds.requestRefund({ paymentId: c.payment.id, amount: 5, reason: 'duplicado teste S14', idempotencyKey: key, actorId: adminUser.id });
    assert.equal(a.refund.id, b.refund.id);
    assert.equal(b.idempotent, true);
    assert.equal(fake.count('POST', /\/refunds$/) - before, 1);
    await assert.rejects(() => refunds.requestRefund({ paymentId: c.payment.id, amount: 6, reason: 'mesma chave outro valor', idempotencyKey: key, actorId: adminUser.id }), (e: any) => code(e) === 'IDEMPOTENCY_KEY_REUSED');
  });

  await scenario('S15', 'Estorno recusado pelo provedor → FAILED, pagamento segue PAID, sem débito', async () => {
    const c = await paidOrder(5);
    fake.refundStatus = 'rejected';
    const r: any = await refunds.requestRefund({ paymentId: c.payment.id, reason: 'provedor recusa teste S15', idempotencyKey: `omega-s15-${randomUUID()}`, actorId: adminUser.id }).catch((e) => ({ err: code(e) }));
    fake.refundStatus = 'approved';
    const row = await prisma.paymentRefund.findFirstOrThrow({ where: { paymentId: c.payment.id } });
    assert.equal(row.status, 'FAILED');
    assert.equal((await pay(c.payment.id)).financialState, 'PAID');
    assert.equal(types(await ledger(c.payment.id)).includes('REFUND_COMPLETED'), false);
    return `result=${JSON.stringify(r).slice(0, 80)}`;
  });

  await scenario('S16', 'Estorno travado (in_process no MP) → reconciliação com autoRepair conclui', async () => {
    const c = await paidOrder(5);
    fake.refundStatus = 'in_process';
    await refunds.requestRefund({ paymentId: c.payment.id, amount: 7, reason: 'estorno lento teste S16', idempotencyKey: `omega-s16-${randomUUID()}`, actorId: adminUser.id });
    fake.refundStatus = 'approved';
    const row = await prisma.paymentRefund.findFirstOrThrow({ where: { paymentId: c.payment.id } });
    assert.equal(row.status, 'PROCESSING');
    fake.settleRefund(c.payment.externalId!, row.providerRefundId!, 'approved');
    await prisma.$executeRaw`UPDATE "PaymentRefund" SET "updatedAt" = NOW() - INTERVAL '1 hour' WHERE "id" = ${row.id}`;
    await recon.run({ scope: 'PAYMENT', paymentId: c.payment.id, origin: 'test', autoRepair: true });
    assert.equal((await prisma.paymentRefund.findUniqueOrThrow({ where: { id: row.id } })).status, 'COMPLETED');
    assert.equal((await pay(c.payment.id)).financialState, 'PARTIALLY_REFUNDED');
  });

  await scenario('S16b', 'Estorno travado + GET /refunds 405 (como no sandbox real) → fallback payment.refunds[] conclui', async () => {
    const c = await paidOrder(5);
    fake.refundStatus = 'in_process';
    await refunds.requestRefund({ paymentId: c.payment.id, amount: 6, reason: 'estorno lento teste S16b', idempotencyKey: `omega-s16b-${randomUUID()}`, actorId: adminUser.id });
    fake.refundStatus = 'approved';
    const row = await prisma.paymentRefund.findFirstOrThrow({ where: { paymentId: c.payment.id } });
    assert.equal(row.status, 'PROCESSING');
    fake.settleRefund(c.payment.externalId!, row.providerRefundId!, 'approved');
    fake.refundListStatus = 405;
    try {
      await prisma.$executeRaw`UPDATE "PaymentRefund" SET "updatedAt" = NOW() - INTERVAL '1 hour' WHERE "id" = ${row.id}`;
      await recon.run({ scope: 'PAYMENT', paymentId: c.payment.id, origin: 'test', autoRepair: true });
    } finally {
      fake.refundListStatus = 200;
    }
    assert.equal((await prisma.paymentRefund.findUniqueOrThrow({ where: { id: row.id } })).status, 'COMPLETED');
    assert.equal((await pay(c.payment.id)).financialState, 'PARTIALLY_REFUNDED');
  });

  await scenario('S17', 'Refunds desativados por padrão (FINANCE_REFUNDS_ENABLED)', async () => {
    process.env.FINANCE_REFUNDS_ENABLED = 'false';
    try {
      await assert.rejects(() => refunds.requestRefund({ paymentId: randomUUID(), reason: 'qualquer motivo aqui', idempotencyKey: `omega-s17-${randomUUID()}`, actorId: adminUser.id }), (e: any) => code(e) === 'FINANCE_REFUNDS_DISABLED');
    } finally {
      process.env.FINANCE_REFUNDS_ENABLED = 'true';
    }
  });

  // ---------------------------------------------------------------- CHARGEBACK
  await scenario('S18', 'Chargeback (topic_chargebacks_wh) → caso registrado, CHARGEBACK_LOST, ledger; volta a PAID proibida', async () => {
    const c = await paidOrder(5);
    const caseId = `TEST-CASE-${randomUUID().slice(0, 8)}`;
    fake.chargebacks.set(caseId, { id: caseId, payments: [c.payment.externalId], amount: Number(c.payment.amount), currency: 'BRL', reason: 'fraud', coverage_applied: false, documentation_status: 'pending', date_documentation_deadline: new Date(Date.now() + 7 * 86400_000).toISOString() });
    fake.setPayment(c.payment.externalId!, { status: 'charged_back', status_detail: 'settled' });
    await webhook(caseId, undefined, 'topic_chargebacks_wh', { data: { id: caseId, payment_id: c.payment.externalId } });
    const cb = await prisma.chargeback.findFirstOrThrow({ where: { providerCaseId: caseId } });
    assert.equal(cb.paymentId, c.payment.id);
    assert.equal((await pay(c.payment.id)).financialState, 'CHARGEBACK_LOST');
    assert.ok(types(await ledger(c.payment.id)).includes('CHARGEBACK_LOST'));
    assert.ok(fake.calls.some((x) => x.path === `/v1/chargebacks/${caseId}` && x.callerId === 'TEST-FAKE-CALLER'), 'X-Caller-Id sent');
    fake.setPayment(c.payment.externalId!, { status: 'approved', status_detail: 'accredited' });
    await webhook(c.payment.externalId!);
    assert.equal((await pay(c.payment.id)).financialState, 'CHARGEBACK_LOST', 'CHARGEBACK_LOST → PAID forbidden');
  });

  // ---------------------------------------------------------------- STOCK / RESERVATION
  await scenario('S19', 'Reserva não expira com pagamento aprovado pendente de confirmação', async () => {
    const c = await checkout(1, 5);
    const p = await intent(c.user.id, c.order.id, 'pix');
    // Simulate crash between payment update and order confirmation: payment approved, order still awaiting.
    await prisma.payment.update({ where: { id: p.id }, data: { status: 'approved' } });
    await prisma.order.update({ where: { id: c.order.id }, data: { reservationExpiresAt: new Date(Date.now() - 5 * 3600_000) } });
    await orders.expireReservations();
    const o = await prisma.order.findUniqueOrThrow({ where: { id: c.order.id } });
    assert.equal(o.status, 'awaiting_payment', 'must not cancel/release stock of a paid order');
    assert.equal((await inv(c.product.id)).qtyReserved, 1);
    // Recovery: reconciliation detects + repairs through the normal path.
    fake.setPayment(p.externalId, { status: 'approved', status_detail: 'accredited' });
    await recon.run({ scope: 'PAYMENT', paymentId: p.id, origin: 'test', withProvider: true });
    assert.equal((await discrepancies({ paymentId: p.id, type: 'APPROVED_ORDER_NOT_PAID', status: { not: 'RESOLVED' } })).length, 1);
    await recon.run({ scope: 'PAYMENT', paymentId: p.id, origin: 'test', autoRepair: true });
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: c.order.id } })).status, 'paid');
    assert.equal((await moves(c.order.id)).filter((m) => m.kind === 'COMMIT').length, 1);
    const d = await discrepancies({ paymentId: p.id, type: 'APPROVED_ORDER_NOT_PAID' });
    assert.equal(d[0].status, 'OPEN', 'CRITICAL never auto-resolved');
    assert.equal(d[0].conditionCleared, true);
  });

  await scenario('S20', 'Reserva sem pagamento → discrepância + liberação admin (confirmação/motivo/auditoria)', async () => {
    const c = await checkout(1, 5);
    await prisma.order.update({ where: { id: c.order.id }, data: { reservationExpiresAt: new Date(Date.now() - 4 * 3600_000) } });
    await recon.run({ scope: 'ORDER', orderId: c.order.id, origin: 'test', withProvider: false });
    assert.equal((await discrepancies({ orderId: c.order.id, type: 'RESERVATION_WITHOUT_PAYMENT' })).length, 1);
    const r = await admin.releaseReservation(c.order.id, adminUser.id, 'reserva vencida sem pagamento — teste S20');
    assert.equal(r.released, true);
    assert.equal((await inv(c.product.id)).qtyReserved, 0);
    assert.ok(await prisma.financialAuditEvent.findFirst({ where: { orderId: c.order.id, action: 'order.reservation_released' } }));
    await recon.run({ scope: 'ORDER', orderId: c.order.id, origin: 'test', withProvider: false });
    const d = await discrepancies({ orderId: c.order.id, type: 'RESERVATION_WITHOUT_PAYMENT' });
    assert.equal(d[0].status, 'RESOLVED', 'MEDIUM auto-resolved once the condition cleared');
    // not allowed with an active payment
    const c2 = await checkout(1, 5);
    await intent(c2.user.id, c2.order.id, 'pix');
    await assert.rejects(() => admin.releaseReservation(c2.order.id, adminUser.id, 'não deveria liberar — teste'), (e: any) => code(e) === 'ORDER_HAS_ACTIVE_PAYMENT');
  });

  // ---------------------------------------------------------------- FAILURES / RETRY
  await scenario('S21', 'Provedor fora do ar no webhook → 5xx (MP re-tenta) → retry processa', async () => {
    const c = await checkout(1, 5);
    const p = await intent(c.user.id, c.order.id, 'pix');
    fake.setPayment(p.externalId, { status: 'approved', status_detail: 'accredited' });
    fake.failNext((m, path) => m === 'GET' && path === `/v1/payments/${p.externalId}`, 503, 1);
    const reqId = randomUUID();
    await assert.rejects(() => webhook(p.externalId, reqId));
    const ev = await prisma.paymentEvent.findFirstOrThrow({ where: { providerEventId: reqId } });
    assert.equal(ev.processingStatus, 'FAILED');
    assert.equal((await pay(p.id)).status, 'pending');
    await webhook(p.externalId, reqId); // MP retry: same x-request-id
    assert.equal((await pay(p.id)).financialState, 'PAID');
    assert.equal((await prisma.paymentEvent.findFirstOrThrow({ where: { providerEventId: reqId } })).processingStatus, 'PROCESSED');
  });

  await scenario('S22', 'Provedor fora do ar na criação do PIX → erro; retry com mesma chave → 1 cobrança no MP', async () => {
    const c = await checkout(1, 5);
    const key = `omega-s22-${randomUUID()}`;
    fake.failNext((m, path) => m === 'POST' && path === '/v1/payments', 500, 1);
    const first = await intent(c.user.id, c.order.id, 'pix', key).then(() => 'ok', (e) => `err:${code(e) || e?.status || e?.message}`);
    const p = await intent(c.user.id, c.order.id, 'pix', key);
    assert.ok(p.externalId);
    const mpPayments = [...fake.payments.values()].filter((x) => x.external_reference === c.order.publicId);
    assert.equal(mpPayments.length, 1, 'exactly one provider payment for the order');
    return `first=${first}`;
  });

  await scenario('S23', 'Webhook de pagamento aprovado perdido (API/webhook fora) → reconciliação recupera', async () => {
    const c = await checkout(1, 5);
    const p = await intent(c.user.id, c.order.id, 'pix');
    fake.setPayment(p.externalId, { status: 'approved', status_detail: 'accredited' }); // no webhook delivered
    const r1 = await recon.run({ scope: 'PAYMENT', paymentId: p.id, origin: 'test' });
    const d = await discrepancies({ paymentId: p.id, type: 'APPROVED_NOT_APPLIED' });
    assert.equal(d[0]?.severity, 'HIGH');
    await recon.run({ scope: 'PAYMENT', paymentId: p.id, origin: 'test', autoRepair: true });
    assert.equal((await pay(p.id)).financialState, 'PAID');
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: c.order.id } })).status, 'paid');
    return `run1=${r1.status}`;
  });

  await scenario('S24', 'Assinatura inválida → 401, nada processado', async () => {
    const reqId = randomUUID();
    await assert.rejects(
      () => payments.handleWebhook({ 'x-signature': 'ts=1,v1=00', 'x-request-id': reqId } as any, { data: { id: '1' } }, { 'data.id': '1' }),
      (e: any) => (e?.status ?? e?.getStatus?.()) === 401,
    );
    assert.equal(await prisma.paymentEvent.count({ where: { providerEventId: reqId } }), 0);
  });

  await scenario('S25', 'merchant_order não é buscado como pagamento (sem loop de 5xx)', async () => {
    const before = fake.calls.length;
    const r: any = await webhook('123456', undefined, 'merchant_order');
    assert.equal(fake.calls.length, before, 'no provider call');
    return `reason=${r.reason}`;
  });

  // ---------------------------------------------------------------- CONCURRENCY
  await scenario('C01', '100 webhooks simultâneos (request ids distintos) p/ mesmo pagamento → 1 estado final', async () => {
    const c = await checkout(1, 5);
    const p = await intent(c.user.id, c.order.id, 'pix');
    fake.setPayment(p.externalId, { status: 'approved', status_detail: 'accredited' });
    const res = await Promise.allSettled(Array.from({ length: 100 }, () => webhook(p.externalId)));
    const rejected = res.filter((r) => r.status === 'rejected').length;
    assert.equal(rejected, 0, `rejected=${rejected}`);
    assert.equal(await prisma.paymentStateTransition.count({ where: { paymentId: p.id, toState: 'PAID' } }), 1);
    assert.equal((await ledger(p.id)).filter((l) => l.entryType === 'PAYMENT_CAPTURED').length, 1);
    assert.equal((await moves(c.order.id)).filter((m) => m.kind === 'COMMIT').length, 1);
    assert.equal(await prisma.orderStatusHistory.count({ where: { orderId: c.order.id, toStatus: 'paid' } }), 1);
    const i = await inv(c.product.id);
    assert.equal(i.qtyOnHand, 4);
    assert.equal(i.qtyReserved, 0);
    return '1 PAID transition, 1 capture, 1 stock commit, onHand 5→4';
  });

  await scenario('C02', '100 entregas do MESMO webhook simultâneas → 1 evento, 1 aplicação', async () => {
    const c = await checkout(1, 5);
    const p = await intent(c.user.id, c.order.id, 'pix');
    fake.setPayment(p.externalId, { status: 'approved', status_detail: 'accredited' });
    const reqId = randomUUID();
    const res = await Promise.allSettled(Array.from({ length: 100 }, () => webhook(p.externalId, reqId)));
    assert.equal(await prisma.paymentEvent.count({ where: { providerEventId: reqId } }), 1);
    assert.equal(await prisma.paymentStateTransition.count({ where: { paymentId: p.id, toState: 'PAID' } }), 1);
    assert.equal((await moves(c.order.id)).filter((m) => m.kind === 'COMMIT').length, 1);
    return `fulfilled=${res.filter((r) => r.status === 'fulfilled').length}/100`;
  });

  await scenario('C03', '100 confirmações (reprocess) simultâneas → 1 confirmação', async () => {
    const c = await checkout(1, 5);
    const p = await intent(c.user.id, c.order.id, 'pix');
    fake.setPayment(p.externalId, { status: 'approved', status_detail: 'accredited' });
    const res = await Promise.allSettled(Array.from({ length: 100 }, () => recon.reprocessPayment(p.id, { actorId: adminUser.id, origin: 'test', reason: 'concurrency test C03' })));
    assert.equal(res.filter((r) => r.status === 'rejected').length, 0);
    const reasons = res.map((r: any) => r.value?.reason);
    const transitioned = reasons.filter((x) => x === 'approved').length;
    assert.equal(transitioned, 1, `reasons=${JSON.stringify([...new Set(reasons)])}`);
    assert.ok(reasons.every((x) => x === 'approved' || x === 'already_approved_notify'), JSON.stringify([...new Set(reasons)]));
    assert.equal(await prisma.paymentStateTransition.count({ where: { paymentId: p.id, toState: 'PAID' } }), 1);
    assert.equal((await moves(c.order.id)).filter((m) => m.kind === 'COMMIT').length, 1);
    return `1 transition (approved), 99 idempotent (already_approved_notify)`;
  });

  await scenario('C04', '100 estornos totais simultâneos (chaves distintas) → 1 estorno, 1 chamada ao MP', async () => {
    const c = await paidOrder(5);
    const before = fake.count('POST', /\/refunds$/);
    const res = await Promise.allSettled(Array.from({ length: 100 }, (_, i) => refunds.requestRefund({ paymentId: c.payment.id, reason: 'concorrência de estornos C04', idempotencyKey: `omega-c04-${i}-${randomUUID()}`, actorId: adminUser.id })));
    const ok = res.filter((r) => r.status === 'fulfilled').length;
    const codes = res.filter((r) => r.status === 'rejected').map((r: any) => code(r.reason));
    assert.equal(ok, 1, `fulfilled=${ok} codes=${[...new Set(codes)]}`);
    assert.ok(codes.every((x) => x === 'REFUND_EXCEEDS_PAID' || x === 'NOTHING_TO_REFUND' || x === 'PAYMENT_NOT_REFUNDABLE'), `codes=${[...new Set(codes)]}`);
    assert.equal(fake.count('POST', /\/refunds$/) - before, 1);
    assert.equal(await prisma.paymentRefund.count({ where: { paymentId: c.payment.id } }), 1);
    assert.equal((await moves(c.order.id)).filter((m) => m.kind === 'RESTOCK').length, 1);
    return `1 ok, 99 rejected (${[...new Set(codes)].join(',')})`;
  });

  await scenario('C05', '100 estornos com a MESMA chave simultâneos → 1 estorno', async () => {
    const c = await paidOrder(5);
    const key = `omega-c05-${randomUUID()}`;
    const res = await Promise.allSettled(Array.from({ length: 100 }, () => refunds.requestRefund({ paymentId: c.payment.id, amount: 3, reason: 'mesma chave concorrente C05', idempotencyKey: key, actorId: adminUser.id })));
    assert.equal(await prisma.paymentRefund.count({ where: { paymentId: c.payment.id } }), 1);
    return `fulfilled=${res.filter((r) => r.status === 'fulfilled').length}/100`;
  });

  await scenario('C06', 'Dois compradores, última unidade → nunca vende a mais', async () => {
    const p = await product(1);
    const buyers = await Promise.all([buyer('last-a'), buyer('last-b')]);
    for (const b of buyers) {
      const cart = await prisma.cart.create({ data: { userId: b.user.id } });
      await prisma.cartItem.create({ data: { cartId: cart.id, productId: p.id, qty: 1 } });
    }
    const res = await Promise.allSettled(buyers.map((b) => orders.create(b.user.id, { addressId: b.address.id } as any, `omega-last-${randomUUID()}`)));
    assert.equal(res.filter((r) => r.status === 'fulfilled').length, 1);
    const i = await inv(p.id);
    assert.equal(i.qtyReserved, 1);
    assert.ok(i.qtyOnHand - i.qtyReserved >= 0);
    return `wins=1, reserved=1, onHand=1`;
  });

  await scenario('C07', '10 compradores, última unidade + pagamento → 1 venda, estoque 0, nunca negativo', async () => {
    const p = await product(1);
    const buyers = await Promise.all(Array.from({ length: 10 }, (_, i) => buyer(`last10-${i}`)));
    for (const b of buyers) {
      const cart = await prisma.cart.create({ data: { userId: b.user.id } });
      await prisma.cartItem.create({ data: { cartId: cart.id, productId: p.id, qty: 1 } });
    }
    const res = await Promise.allSettled(buyers.map((b) => orders.create(b.user.id, { addressId: b.address.id } as any, `omega-last10-${randomUUID()}`)));
    const wins = res.map((r, i) => ({ r, b: buyers[i] })).filter((x) => x.r.status === 'fulfilled');
    assert.equal(wins.length, 1);
    const w: any = (wins[0].r as PromiseFulfilledResult<any>).value;
    const orderId = w.id ?? w.order?.id;
    const pi = await intent(wins[0].b.user.id, orderId, 'pix');
    fake.setPayment(pi.externalId, { status: 'approved', status_detail: 'accredited' });
    await Promise.all(Array.from({ length: 20 }, () => webhook(pi.externalId)));
    const i = await inv(p.id);
    assert.equal(i.qtyOnHand, 0);
    assert.equal(i.qtyReserved, 0);
  });

  await scenario('C08', '20 reconciliações globais simultâneas → 1 executa, demais SKIPPED_LOCKED, sem discrepância duplicada', async () => {
    const res = await Promise.allSettled(Array.from({ length: 20 }, () => recon.run({ scope: 'PERIOD', origin: 'test', withProvider: false, from: new Date(Date.now() - 3600_000) })));
    const statuses = res.map((r: any) => r.value?.status ?? `ERR:${r.reason?.message}`);
    const completed = statuses.filter((s) => s === 'COMPLETED').length;
    const skipped = statuses.filter((s) => s === 'SKIPPED_LOCKED').length;
    assert.equal(completed + skipped, 20, JSON.stringify(statuses));
    assert.ok(completed >= 1);
    const dup = await prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM (SELECT "dedupeKey" FROM "FinancialDiscrepancy" GROUP BY "dedupeKey" HAVING COUNT(*) > 1) x`;
    assert.equal(Number(dup[0].n), 0);
    return `completed=${completed}, skipped=${skipped}`;
  });

  await scenario('C09', 'Duas intenções simultâneas p/ mesmo pedido → no máximo 1 pendente', async () => {
    const c = await checkout(1, 5);
    const res = await Promise.allSettled([intent(c.user.id, c.order.id, 'pix'), intent(c.user.id, c.order.id, 'pix')]);
    const pend = await prisma.payment.count({ where: { orderId: c.order.id, status: 'pending' } });
    assert.equal(pend, 1);
    return `fulfilled=${res.filter((r) => r.status === 'fulfilled').length}`;
  });

  // ---------------------------------------------------------------- APPEND-ONLY / ADMIN
  await scenario('A01', 'Ledger/auditoria/transições/movimentos são append-only (trigger rejeita UPDATE/DELETE)', async () => {
    for (const table of ['FinancialLedgerEntry', 'FinancialAuditEvent', 'PaymentStateTransition', 'InventoryMovement']) {
      await assert.rejects(() => prisma.$executeRawUnsafe(`UPDATE "${table}" SET "createdAt" = NOW() WHERE "id" IN (SELECT "id" FROM "${table}" LIMIT 1)`), `${table} UPDATE`);
      await assert.rejects(() => prisma.$executeRawUnsafe(`DELETE FROM "${table}" WHERE "id" IN (SELECT "id" FROM "${table}" LIMIT 1)`), `${table} DELETE`);
    }
  });

  await scenario('A02', 'Dashboard/health usam dados reais do banco', async () => {
    const d: any = await admin.dashboard();
    const today = await prisma.financialLedgerEntry.aggregate({ where: { entryType: 'PAYMENT_CAPTURED', createdAt: { gte: new Date(d.todayStartsAt) }, source: { not: 'reconciliation_backfill' } }, _sum: { amount: true } });
    assert.equal(d.receivedToday.amount, Math.round(Number(today._sum.amount || 0) * 100) / 100);
    assert.equal(d.source, 'database');
    const h: any = await admin.health();
    assert.ok(['OK', 'WARN', 'ATTENTION'].includes(h.status));
    assert.ok(h.process.counters.webhook_received > 0);
    return `receivedToday=R$${d.receivedToday.amount} (${d.receivedToday.count}), health=${h.status}`;
  });

  await scenario('A03', 'Resolver discrepância CRÍTICA exige motivo detalhado e audita', async () => {
    const d = await prisma.financialDiscrepancy.findFirstOrThrow({ where: { severity: 'CRITICAL', status: { not: 'RESOLVED' } } });
    await assert.rejects(() => admin.resolveDiscrepancy(d.id, 'RESOLVED', adminUser.id, 'curto demais'), (e: any) => code(e) === 'CRITICAL_REASON_TOO_SHORT');
    await admin.resolveDiscrepancy(d.id, 'RESOLVED', adminUser.id, 'conferido no painel do Mercado Pago e tratado manualmente (teste)');
    assert.ok(await prisma.financialAuditEvent.findFirst({ where: { action: 'discrepancy.resolved', meta: { path: ['discrepancyId'], equals: d.id } } }));
  });

  // Hide this run's test products from the storefront listing (local DB is shared by other specs).
  await prisma.product.updateMany({ where: { sku: { startsWith: 'OMEGA-' } }, data: { active: false } });
  await app.close();
  await fake.stop();

  const nonTestProviderCalls = fake.calls.filter((c) => !c.path.startsWith('/v1/'));
  assert.equal(nonTestProviderCalls.length, 0);
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log(`\nfinance.db.spec: ${passed} PASS / ${failed} FAIL (fake provider calls: ${fake.calls.length}, all to ${fake.baseUrl})`);
  if (failed) process.exit(1);
}

main().catch(async (e) => {
  console.error('finance.db.spec FATAL', e);
  await fake.stop().catch(() => undefined);
  process.exit(1);
});
