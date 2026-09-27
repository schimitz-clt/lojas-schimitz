/**
 * Refund ledger race (production incident 2026-09-26, MP 180103052643): the real refund webhook
 * arrived ~0.3 s BEFORE Mercado Pago answered POST /refunds. The webhook sync path wrote
 * REFUND_COMPLETED:sync:<payment>:<cents> and RefundsService.markCompleted then wrote
 * REFUND_COMPLETED:<refundId> → the same R$ 1,00 debited twice.
 *
 * These scenarios reproduce that deterministically (the fake MP delivers the webhook from inside the
 * POST /refunds handler, after its state changed and before the HTTP response), the reverse order,
 * the legacy observation without refund ids, 100 randomized concurrent races, partial refunds and the
 * append-only corrective adjustment used to repair the production row.
 *
 * Local Postgres + LOCAL fake MP only (same guards as finance.db.spec.ts).
 */
import assert from 'assert';
import { createHmac, randomUUID } from 'crypto';
import * as argon2 from 'argon2';
import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { FakeMercadoPagoServer } from './testing/fake-mercadopago.server';
import { summarizeRefundLedger } from './financial-recorder.service';

const WEBHOOK_SECRET = 'fake-local-test-webhook-secret-0123456789';

function assertLocalDb() {
  const url = process.env.DATABASE_URL || '';
  if (!url) throw new Error('DATABASE_URL obrigatória');
  if (/railway|rlwy|\.internal|prod/i.test(url)) throw new Error('RECUSADO: DATABASE_URL parece produção');
  if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error('RECUSADO: DATABASE_URL deve ser local');
}

const fake = new FakeMercadoPagoServer();
const results: { id: string; ok: boolean }[] = [];
async function scenario(id: string, name: string, fn: () => Promise<string | void>) {
  const t0 = Date.now();
  try {
    const detail = await fn();
    results.push({ id, ok: true });
    console.log(`  PASS ${id} ${name}${detail ? ' — ' + detail : ''} (${Date.now() - t0}ms)`);
  } catch (e: any) {
    results.push({ id, ok: false });
    console.log(`  FAIL ${id} ${name}\n${String(e?.stack || e).slice(0, 1500)}`);
  }
}
const code = (e: any) => e?.response?.code || e?.getResponse?.()?.code || e?.code;
const money = (n: unknown) => Math.round(Number(n || 0) * 100) / 100;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  assertLocalDb();
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

  const { AppModule } = await import('../../app.module');
  const { PrismaService } = await import('../../prisma.service');
  const { PaymentsService } = await import('../payments/payments.service');
  const { OrdersService } = await import('../orders/orders.service');
  const { RefundsService } = await import('./refunds.service');
  const { ReconciliationService } = await import('./reconciliation.service');
  const { FinanceAdminService } = await import('./finance-admin.service');
  const { FinancialRecorder } = await import('./financial-recorder.service');

  const app: INestApplicationContext = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const payments = app.get(PaymentsService);
  const orders = app.get(OrdersService);
  const refunds = app.get(RefundsService);
  const recon = app.get(ReconciliationService);
  const admin = app.get(FinanceAdminService);
  const recorder = app.get(FinancialRecorder);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "SchedulerLock" ("id" TEXT PRIMARY KEY, "holder" TEXT NOT NULL, "expiresAt" TIMESTAMPTZ NOT NULL)`);

  const adminUser = await prisma.user.create({ data: { email: `race-admin-${randomUUID().slice(0, 8)}@test.local`, passwordHash: 'x', name: 'Race Admin', role: 'admin' } });
  const seller = await prisma.seller.upsert({
    where: { slug: 'lojas-schimitz' },
    update: {},
    create: { id: '00000000-0000-4000-8000-000000000001', name: 'Lojas Schimitz', slug: 'lojas-schimitz', status: 'active' },
  });
  const pwHash = await argon2.hash('race-test-pass');

  async function paidOrder(price = 100) {
    const user = await prisma.user.create({ data: { email: `race-${randomUUID().slice(0, 8)}@test.local`, passwordHash: pwHash, name: 'Race Buyer', role: 'customer', status: 'active', phone: '51999999999' } });
    const address = await prisma.address.create({ data: { userId: user.id, label: 'Casa', cep: '91250000', street: 'Rua Teste', number: '1', district: 'Centro', city: 'Porto Alegre', uf: 'RS' } });
    const sku = `OMEGA-RACE-${randomUUID().slice(0, 8)}`;
    const product = await prisma.product.create({ data: { sku, name: `Race ${sku}`, slug: sku.toLowerCase(), description: 'refund race test', price, active: true, sellerId: seller.id, inventory: { create: { qtyOnHand: 5, qtyReserved: 0 } } } });
    const cart = await prisma.cart.create({ data: { userId: user.id } });
    await prisma.cartItem.create({ data: { cartId: cart.id, productId: product.id, qty: 1 } });
    const created: any = await orders.create(user.id, { addressId: address.id } as any, `race-order-${randomUUID()}`);
    const orderId = created.id ?? created.order?.id;
    const r: any = await payments.createIntent(user.id, { orderId, method: 'pix' } as any, `race-intent-${randomUUID()}`);
    fake.setPayment(r.payment.externalId, { status: 'approved', status_detail: 'accredited' });
    await webhook(r.payment.externalId);
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: r.payment.id } });
    assert.equal(payment.financialState, 'PAID');
    return { user, product, orderId, payment, ext: payment.externalId! };
  }
  function webhook(dataId: string) {
    const requestId = randomUUID();
    const ts = String(Math.floor(Date.now() / 1000));
    const v1 = createHmac('sha256', WEBHOOK_SECRET).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest('hex');
    return payments.handleWebhook(
      { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': requestId } as any,
      { id: Math.floor(Math.random() * 1e12), type: 'payment', action: 'payment.updated', data: { id: dataId } },
      { 'data.id': dataId, type: 'payment' },
    );
  }

  // Per-payment webhook injection from INSIDE the fake POST /refunds handler (state changed, response not sent).
  const hook = new Map<string, 'await' | 'fire'>();
  const hookErrors: string[] = [];
  fake.beforeSend = async (method, path) => {
    const m = method === 'POST' ? path.match(/^\/v1\/payments\/([^/]+)\/refunds$/) : null;
    const mode = m ? hook.get(decodeURIComponent(m[1])) : undefined;
    if (!mode) return;
    const run = webhook(decodeURIComponent(m![1])).catch((e) => { hookErrors.push(String(e?.message || e)); });
    if (mode === 'await') await run;
  };

  const refundRows = (paymentId: string) => prisma.financialLedgerEntry.findMany({ where: { paymentId, entryType: 'REFUND_COMPLETED' }, orderBy: { createdAt: 'asc' } });
  async function netRefunded(paymentId: string) {
    return (await recorder.refundLedgerSummary(prisma, paymentId)).total;
  }
  async function ledgerMismatchOpen(paymentId: string) {
    await recon.run({ scope: 'PAYMENT', paymentId, withProvider: true, autoRepair: false, origin: 'test' });
    return prisma.financialDiscrepancy.findMany({
      where: { paymentId, type: { in: ['LEDGER_BALANCE_MISMATCH', 'REFUND_AMOUNT_MISMATCH'] }, status: { not: 'RESOLVED' }, conditionCleared: false },
    });
  }
  async function assertFullRefundOnce(c: { payment: { id: string; amount: unknown }; orderId: string }, label: string) {
    const rows = await refundRows(c.payment.id);
    assert.equal(rows.length, 1, `${label}: REFUND_COMPLETED rows=${rows.length} keys=${rows.map((r) => r.idempotencyKey)}`);
    assert.equal(money(rows[0].amount), money(c.payment.amount), `${label}: amount`);
    const p = await prisma.payment.findUniqueOrThrow({ where: { id: c.payment.id } });
    assert.equal(p.status, 'refunded', `${label}: status`);
    assert.equal(p.financialState, 'REFUNDED', `${label}: financialState`);
    assert.equal(await prisma.paymentStateTransition.count({ where: { paymentId: c.payment.id, toState: 'REFUNDED' } }), 1, `${label}: transitions`);
    assert.equal(await prisma.inventoryMovement.count({ where: { orderId: c.orderId, kind: 'RESTOCK' } }), 1, `${label}: restock`);
    assert.equal((await prisma.paymentRefund.findFirstOrThrow({ where: { paymentId: c.payment.id } })).status, 'COMPLETED', `${label}: refund status`);
    return rows[0];
  }

  console.log('Refund ledger race scenarios:');

  await scenario('R00', 'summarizeRefundLedger (puro): correções e atribuição externa por id do MP', async () => {
    const rows = [
      { id: 'a', entryType: 'REFUND_COMPLETED', direction: 'DEBIT', amount: 1, refundId: null, idempotencyKey: 'REFUND_COMPLETED:sync:p:100', meta: {} },
      { id: 'b', entryType: 'REFUND_COMPLETED', direction: 'DEBIT', amount: 1, refundId: 'r1', idempotencyKey: 'REFUND_COMPLETED:r1', meta: {} },
      { id: 'c', entryType: 'REFUND_COMPLETED', direction: 'DEBIT', amount: 4, refundId: null, idempotencyKey: 'REFUND_COMPLETED:mp:900', meta: {} },
      { id: 'd', entryType: 'ADJUSTMENT_CREATED', direction: 'CREDIT', amount: 1, refundId: null, idempotencyKey: 'ADJUSTMENT_CREATED:x', meta: { correctsLedgerEntryId: 'a', correctsEntryType: 'REFUND_COMPLETED' } },
      { id: 'e', entryType: 'ADJUSTMENT_CREATED', direction: 'CREDIT', amount: 50, refundId: null, idempotencyKey: 'ADJUSTMENT_CREATED:y', meta: {} },
    ];
    assert.deepEqual(summarizeRefundLedger(rows, new Set(['900'])), { total: 5, external: 0 });
    assert.deepEqual(summarizeRefundLedger(rows, new Set()), { total: 5, external: 4 });
  });

  await scenario('R01', 'Webhook ANTES da resposta do MP (incidente real) → exatamente 1 REFUND_COMPLETED', async () => {
    const c = await paidOrder(100);
    hook.set(c.ext, 'await');
    const r: any = await refunds.requestRefund({ paymentId: c.payment.id, reason: 'race R01 webhook antes da resposta', idempotencyKey: `race-r01-${randomUUID()}`, actorId: adminUser.id });
    hook.delete(c.ext);
    assert.equal(r.refund.status, 'COMPLETED');
    const row = await assertFullRefundOnce(c, 'R01');
    assert.equal(row.idempotencyKey, `REFUND_COMPLETED:mp:${r.refund.providerRefundId}`);
    const audit = await prisma.financialAuditEvent.findFirstOrThrow({ where: { action: 'refund.completed', refundId: r.refund.id } });
    assert.ok((audit.meta as any).ledgerAlreadyCoveredBy, 'markCompleted must record that the debit was already written');
    assert.equal((await ledgerMismatchOpen(c.payment.id)).length, 0);
    await webhook(c.ext); // late duplicate delivery
    assert.equal((await refundRows(c.payment.id)).length, 1);
    return `key=${row.idempotencyKey} written by ${row.source}`;
  });

  await scenario('R02', 'Ordem inversa: resposta do MP primeiro, webhook depois → 1 REFUND_COMPLETED', async () => {
    const c = await paidOrder(100);
    const r: any = await refunds.requestRefund({ paymentId: c.payment.id, reason: 'race R02 resposta antes do webhook', idempotencyKey: `race-r02-${randomUUID()}`, actorId: adminUser.id });
    await webhook(c.ext);
    await webhook(c.ext);
    const row = await assertFullRefundOnce(c, 'R02');
    assert.equal(row.idempotencyKey, `REFUND_COMPLETED:mp:${r.refund.providerRefundId}`);
    assert.equal(row.refundId, r.refund.id);
    assert.equal((await ledgerMismatchOpen(c.payment.id)).length, 0);
    return `key=${row.idempotencyKey} written by ${row.source}`;
  });

  await scenario('R03', 'Webhook antes da resposta SEM refunds[] (observação legada, só valor) → 1 débito', async () => {
    const c = await paidOrder(100);
    fake.omitRefundsInView = true;
    hook.set(c.ext, 'await');
    try {
      await refunds.requestRefund({ paymentId: c.payment.id, reason: 'race R03 legado sem ids', idempotencyKey: `race-r03-${randomUUID()}`, actorId: adminUser.id });
    } finally {
      hook.delete(c.ext);
      fake.omitRefundsInView = false;
    }
    const row = await assertFullRefundOnce(c, 'R03');
    assert.equal((await ledgerMismatchOpen(c.payment.id)).length, 0);
    return `key=${row.idempotencyKey}`;
  });

  await scenario('R04', 'Estorno + webhook disparados juntos (fire-and-forget dentro do MP) → 1 débito', async () => {
    const c = await paidOrder(100);
    hook.set(c.ext, 'fire');
    await refunds.requestRefund({ paymentId: c.payment.id, reason: 'race R04 simultâneo', idempotencyKey: `race-r04-${randomUUID()}`, actorId: adminUser.id });
    hook.delete(c.ext);
    await sleep(300);
    await assertFullRefundOnce(c, 'R04');
  });

  await scenario('C10', '100 corridas estorno × webhooks × reprocess simultâneos → exatamente 1 REFUND_COMPLETED cada', async () => {
    const N = 100;
    const orders_: Awaited<ReturnType<typeof paidOrder>>[] = [];
    for (let i = 0; i < N; i += 10) orders_.push(...(await Promise.all(Array.from({ length: Math.min(10, N - i) }, () => paidOrder(50 + (i % 7))))));
    const modes = { await: 0, fire: 0, random: 0 };
    for (let i = 0; i < N; i += 10) {
      await Promise.all(orders_.slice(i, i + 10).map(async (c, j) => {
        const k = i + j;
        const mode = k % 3 === 0 ? 'await' : k % 3 === 1 ? 'fire' : 'random';
        modes[mode]++;
        if (mode !== 'random') hook.set(c.ext, mode);
        const jitter = () => sleep(Math.floor(Math.random() * 40));
        await Promise.all([
          refunds.requestRefund({ paymentId: c.payment.id, reason: `race C10 #${k}`, idempotencyKey: `race-c10-${k}-${randomUUID()}`, actorId: adminUser.id }),
          (async () => { await jitter(); await webhook(c.ext); })(),
          (async () => { await jitter(); await webhook(c.ext); })(),
          (async () => { await jitter(); await recon.reprocessPayment(c.payment.id, { actorId: null, origin: 'test', reason: 'race C10' }).catch(() => undefined); })(),
        ]);
        hook.delete(c.ext);
      }));
    }
    await sleep(500);
    await Promise.all(orders_.map((c) => webhook(c.ext))); // final delivery everywhere
    let bad = 0;
    for (const [k, c] of orders_.entries()) {
      try { await assertFullRefundOnce(c, `C10#${k}`); } catch (e: any) { bad++; if (bad <= 3) console.log('   ', String(e.message).slice(0, 300)); }
    }
    assert.equal(bad, 0, `${bad}/${N} payments with != 1 REFUND_COMPLETED`);
    const total = await prisma.financialLedgerEntry.count({ where: { paymentId: { in: orders_.map((c) => c.payment.id) }, entryType: 'REFUND_COMPLETED' } });
    assert.equal(total, N);
    assert.equal(hookErrors.length, 0, hookErrors.slice(0, 3).join(' | '));
    return `${N} payments, ${total} REFUND_COMPLETED rows, modes=${JSON.stringify(modes)}`;
  });

  await scenario('P01', 'Parciais com webhook antes da resposta (10 + restante) → débitos = pago, 1 por estorno', async () => {
    const c = await paidOrder(100);
    const paid = money(c.payment.amount);
    hook.set(c.ext, 'await');
    const a: any = await refunds.requestRefund({ paymentId: c.payment.id, amount: 10, reason: 'race P01 parcial 1', idempotencyKey: `race-p01a-${randomUUID()}`, actorId: adminUser.id });
    assert.equal((await prisma.payment.findUniqueOrThrow({ where: { id: c.payment.id } })).financialState, 'PARTIALLY_REFUNDED');
    assert.equal(await netRefunded(c.payment.id), 10);
    assert.equal((await ledgerMismatchOpen(c.payment.id)).length, 0);
    await assert.rejects(
      () => refunds.requestRefund({ paymentId: c.payment.id, amount: money(paid - 10 + 0.01), reason: 'race P01 excede', idempotencyKey: `race-p01x-${randomUUID()}`, actorId: adminUser.id }),
      (e: any) => code(e) === 'REFUND_EXCEEDS_PAID',
    );
    const b: any = await refunds.requestRefund({ paymentId: c.payment.id, reason: 'race P01 restante', idempotencyKey: `race-p01b-${randomUUID()}`, actorId: adminUser.id });
    hook.delete(c.ext);
    assert.equal(money(b.refund.amount), money(paid - 10));
    const rows = await refundRows(c.payment.id);
    assert.equal(rows.length, 2, `rows=${rows.map((r) => r.idempotencyKey)}`);
    assert.deepEqual(rows.map((r) => r.idempotencyKey).sort(), [`REFUND_COMPLETED:mp:${a.refund.providerRefundId}`, `REFUND_COMPLETED:mp:${b.refund.providerRefundId}`].sort());
    assert.equal(await netRefunded(c.payment.id), paid);
    const p = await prisma.payment.findUniqueOrThrow({ where: { id: c.payment.id } });
    assert.equal(p.financialState, 'REFUNDED');
    assert.equal(await prisma.inventoryMovement.count({ where: { orderId: c.orderId, kind: 'RESTOCK' } }), 1);
    assert.equal((await ledgerMismatchOpen(c.payment.id)).length, 0);
    return `debits ${rows.map((r) => money(r.amount)).join(' + ')} = ${paid}`;
  });

  await scenario('P02', 'Parciais: ordem inversa, sem refunds[] e 10 parciais simultâneos c/ webhooks → soma exata', async () => {
    const c = await paidOrder(100);
    const paid = money(c.payment.amount);
    await refunds.requestRefund({ paymentId: c.payment.id, amount: 5, reason: 'race P02 inversa', idempotencyKey: `race-p02a-${randomUUID()}`, actorId: adminUser.id });
    await webhook(c.ext);
    fake.omitRefundsInView = true;
    hook.set(c.ext, 'await');
    try {
      await refunds.requestRefund({ paymentId: c.payment.id, amount: 7, reason: 'race P02 legado', idempotencyKey: `race-p02b-${randomUUID()}`, actorId: adminUser.id });
    } finally {
      fake.omitRefundsInView = false;
      hook.set(c.ext, 'fire');
    }
    assert.equal(await netRefunded(c.payment.id), 12);
    const res = await Promise.allSettled([
      ...Array.from({ length: 10 }, (_, i) => refunds.requestRefund({ paymentId: c.payment.id, amount: 3, reason: `race P02 concorrente ${i}`, idempotencyKey: `race-p02c-${i}-${randomUUID()}`, actorId: adminUser.id })),
      ...Array.from({ length: 5 }, () => webhook(c.ext)),
    ]);
    hook.delete(c.ext);
    await sleep(300);
    await webhook(c.ext);
    const okRefunds = await prisma.paymentRefund.findMany({ where: { paymentId: c.payment.id, status: 'COMPLETED' } });
    const expected = money(okRefunds.reduce((s, r) => s + money(r.amount), 0));
    assert.equal(await netRefunded(c.payment.id), expected);
    assert.equal((await refundRows(c.payment.id)).length, okRefunds.length);
    assert.ok(expected <= paid);
    assert.equal((await ledgerMismatchOpen(c.payment.id)).length, 0);
    return `${okRefunds.length} refunds, ledger ${expected} (settled=${res.filter((x) => x.status === 'fulfilled').length}/15)`;
  });

  await scenario('A04', 'Correção append-only do débito duplicado (cenário de produção) → líquido 0, reconciliação limpa', async () => {
    const c = await paidOrder(1);
    const amt = money(c.payment.amount);
    const cents = Math.round(amt * 100);
    const r: any = await refunds.requestRefund({ paymentId: c.payment.id, reason: 'A04 estorno total', idempotencyKey: `race-a04-${randomUUID()}`, actorId: adminUser.id });
    // Reproduce the pre-fix duplicate exactly as it exists in production.
    await recorder.appendLedger(prisma, { entryType: 'REFUND_COMPLETED', direction: 'DEBIT', amount: amt, idempotencyKey: `REFUND_COMPLETED:sync:${c.payment.id}:${cents}`, source: 'webhook', paymentId: c.payment.id, orderId: c.orderId, externalId: c.ext, meta: { reason: 'provider_or_legacy_refund_observed', simulatedPreFixBug: true } });
    const dup = await prisma.financialLedgerEntry.findUniqueOrThrow({ where: { idempotencyKey: `REFUND_COMPLETED:sync:${c.payment.id}:${cents}` } });
    const before = await ledgerMismatchOpen(c.payment.id);
    assert.deepEqual(before.map((d) => d.type).sort(), ['LEDGER_BALANCE_MISMATCH', 'REFUND_AMOUNT_MISMATCH']);
    const reason = 'Correção de REFUND_COMPLETED duplicado (teste A04)';
    await assert.rejects(() => admin.createAdjustment({ idempotencyKey: `a04-wrongdir-${randomUUID()}`, direction: 'DEBIT', amount: amt, paymentId: c.payment.id, reason, actorId: adminUser.id, correctsLedgerEntryId: dup.id }), (e: any) => code(e) === 'CORRECTION_DIRECTION_INVALID');
    const key = `a04-fix-${randomUUID()}`;
    const adj = await admin.createAdjustment({ idempotencyKey: key, direction: 'CREDIT', amount: amt, paymentId: c.payment.id, reason, actorId: 'owner-authorized-script', actorRole: 'owner_authorized', correctsLedgerEntryId: dup.id });
    assert.equal(adj.idempotent, false);
    const replay = await admin.createAdjustment({ idempotencyKey: key, direction: 'CREDIT', amount: amt, paymentId: c.payment.id, reason, actorId: 'owner-authorized-script', actorRole: 'owner_authorized', correctsLedgerEntryId: dup.id });
    assert.equal(replay.idempotent, true);
    await assert.rejects(() => admin.createAdjustment({ idempotencyKey: `a04-again-${randomUUID()}`, direction: 'CREDIT', amount: amt, paymentId: c.payment.id, reason, actorId: adminUser.id, correctsLedgerEntryId: dup.id }), (e: any) => code(e) === 'CORRECTION_EXCEEDS_ENTRY');
    assert.equal(await prisma.financialLedgerEntry.count({ where: { paymentId: c.payment.id, entryType: 'ADJUSTMENT_CREATED' } }), 1);
    const audit = await prisma.financialAuditEvent.findFirstOrThrow({ where: { action: 'ledger.adjustment_created', paymentId: c.payment.id } });
    assert.equal(audit.actorRole, 'owner_authorized');
    const all = await prisma.financialLedgerEntry.findMany({ where: { paymentId: c.payment.id } });
    const net = money(all.reduce((s, e) => s + (e.direction === 'CREDIT' ? money(e.amount) : e.direction === 'DEBIT' ? -money(e.amount) : 0), 0));
    assert.equal(net, 0);
    assert.equal((await ledgerMismatchOpen(c.payment.id)).length, 0);
    for (const d of before) await admin.resolveDiscrepancy(d.id, 'RESOLVED', adminUser.id, 'Débito duplicado corrigido por ajuste append-only (teste A04)');
    // After the correction, replays must not add anything (refund owned by legacy/canonical key).
    await webhook(c.ext);
    await recon.run({ scope: 'PAYMENT', paymentId: c.payment.id, withProvider: true, autoRepair: true, origin: 'test' });
    assert.equal((await refundRows(c.payment.id)).length, 2);
    assert.equal(await netRefunded(c.payment.id), amt);
    return `refund ${r.refund.id}: net ledger 0 after correction`;
  });

  fake.beforeSend = null;
  await prisma.product.updateMany({ where: { sku: { startsWith: 'OMEGA-RACE-' } }, data: { active: false } });
  await app.close();
  await fake.stop();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\nfinance.refund-race.db.spec: ${results.length - failed} PASS / ${failed} FAIL`);
  if (failed) process.exit(1);
}

main().catch(async (e) => {
  console.error('finance.refund-race.db.spec FATAL', e);
  await fake.stop().catch(() => undefined);
  process.exit(1);
});
