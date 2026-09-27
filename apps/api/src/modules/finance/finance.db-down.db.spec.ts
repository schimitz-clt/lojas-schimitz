/**
 * COMANDO OMEGA part 1 — automated DB-down / recovery tests.
 * The app talks to the LOCAL test Postgres through a killable TCP proxy; assertions use a direct
 * connection. Mercado Pago = LOCAL FAKE server labelled TEST; real MP env vars are deleted.
 *  D1 webhook while the DB is down → 5xx, no effects; provider retry after recovery → applied once.
 *  D2 DB killed in the middle of 30 concurrent webhook deliveries → after recovery + retries: exactly
 *     one PAID transition, one capture, one stock commit.
 *  D3 DB dies right after Mercado Pago accepted a refund (before we record it) → recovery retry reuses
 *     the SAME provider idempotency key: one provider refund, one local completion, one restock.
 *  D4 reconciliation during the outage fails cleanly; after recovery it completes (no stuck lock).
 */
import assert from 'assert';
import { createHmac, randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { NestFactory } from '@nestjs/core';
import { FakeMercadoPagoServer } from './testing/fake-mercadopago.server';
import { KillableDbProxy } from './testing/killable-db-proxy';

const WEBHOOK_SECRET = 'fake-local-dbdown-webhook-secret-0123456789';
const REAL_MP_ENV = ['MERCADO_PAGO_ACCESS_TOKEN', 'MP_ACCESS_TOKEN', 'MERCADO_PAGO_WEBHOOK_SECRET', 'MP_WEBHOOK_SECRET', 'STAGING_MP_ACCESS_TOKEN', 'STAGING_MP_CLIENT_SECRET', 'PROD_MP_MARKETPLACE_CLIENT_SECRET', 'MERCADO_PAGO_PUBLIC_KEY', 'MERCADO_PAGO_USER_ID', 'PUBLIC_API_URL'];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  const realUrl = process.env.DATABASE_URL || '';
  if (!realUrl || /railway|rlwy|\.internal|prod/i.test(realUrl) || !/127\.0\.0\.1|localhost/.test(realUrl)) throw new Error('RECUSADO: DATABASE_URL deve ser local');
  for (const k of REAL_MP_ENV) delete process.env[k];
  const u = new URL(realUrl);
  const proxy = new KillableDbProxy(u.hostname, Number(u.port || 5432));
  await proxy.up();
  const viaProxy = new URL(realUrl);
  viaProxy.port = String(proxy.port);
  viaProxy.searchParams.set('connect_timeout', '3');
  viaProxy.searchParams.set("pool_timeout", "5");
  const fake = new FakeMercadoPagoServer();
  await fake.start();
  Object.assign(process.env, {
    DATABASE_URL: viaProxy.toString(),
    APP_ENV: 'development', NODE_ENV: 'development', PAYMENTS_PROVIDER: 'mercadopago',
    MERCADO_PAGO_ACCESS_TOKEN: 'TEST-FAKE-LOCAL', MERCADO_PAGO_WEBHOOK_SECRET: WEBHOOK_SECRET, MERCADO_PAGO_API_BASE_URL: fake.baseUrl,
    FINANCE_TEST_MODE: 'true', FINANCE_REFUNDS_ENABLED: 'true', FINANCE_RECONCILIATION_CRON_ENABLED: 'false',
    JWT_ACCESS_SECRET: 'omega-dbdown-access-secret-xxxxxxxxx', JWT_REFRESH_SECRET: 'omega-dbdown-refresh-secret-xxxxxxxx',
  });
  console.log(`[${fake.label}] ${fake.baseUrl}; app DB via killable proxy :${proxy.port}`);

  const direct = new PrismaClient({ datasources: { db: { url: realUrl } }, log: [] });
  const { AppModule } = await import('../../app.module');
  const { PaymentsService } = await import('../payments/payments.service');
  const { OrdersService } = await import('../orders/orders.service');
  const { RefundsService } = await import('./refunds.service');
  const { ReconciliationService } = await import('./reconciliation.service');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const payments = app.get(PaymentsService);
  const orders = app.get(OrdersService);
  const refunds = app.get(RefundsService);
  const recon = app.get(ReconciliationService);
  const { PrismaService } = await import('../../prisma.service');
  const appDb = app.get(PrismaService);
  /**
   * Bring the DB back and wait until the APP's pool works again. Observed with Prisma 6.19: pooled
   * connections killed by the outage keep failing ("Server has closed the connection") for ~15 s
   * after the database is reachable again — requests in that window fail (→ 5xx, MP retries).
   */
  async function recover(): Promise<number> {
    await proxy.up();
    const t0 = Date.now();
    for (;;) {
      try { await appDb.$queryRaw`SELECT 1`; return Date.now() - t0; } catch { if (Date.now() - t0 > 60_000) throw new Error('app DB did not recover in 60s'); await sleep(250); }
    }
  }

  const seller = await direct.seller.upsert({ where: { slug: 'lojas-schimitz' }, update: {}, create: { id: '00000000-0000-4000-8000-000000000001', name: 'Lojas Schimitz', slug: 'lojas-schimitz', status: 'active' } });
  const admin = await direct.user.create({ data: { email: `dbdown-admin-${randomUUID().slice(0, 8)}@test.local`, passwordHash: 'x', name: 'DB-down admin', role: 'admin' } });
  async function paidReadyOrder(stock = 5) {
    const user = await direct.user.create({ data: { email: `dbdown-${randomUUID().slice(0, 8)}@test.local`, passwordHash: 'x', name: 'DB-down buyer', role: 'customer', status: 'active', phone: '51999999999' } });
    const address = await direct.address.create({ data: { userId: user.id, label: 'Casa', cep: '91250000', street: 'Rua Teste', number: '1', district: 'Centro', city: 'Porto Alegre', uf: 'RS' } });
    const sku = `OMEGA-DBD-${randomUUID().slice(0, 8)}`;
    const product = await direct.product.create({ data: { sku, name: `DB-down ${sku}`, slug: sku.toLowerCase(), description: 'omega financial test product', price: 100, active: true, sellerId: seller.id, inventory: { create: { qtyOnHand: stock, qtyReserved: 0 } } } });
    const cart = await direct.cart.create({ data: { userId: user.id } });
    await direct.cartItem.create({ data: { cartId: cart.id, productId: product.id, qty: 1 } });
    const created: any = await orders.create(user.id, { addressId: address.id } as any, `dbdown-order-${randomUUID()}`);
    const orderId = created.id ?? created.order?.id;
    const r: any = await payments.createIntent(user.id, { orderId, method: 'pix' } as any, `dbdown-intent-${randomUUID()}`);
    return { user, product, orderId, payment: r.payment as { id: string; externalId: string } };
  }
  function webhook(dataId: string, requestId: string = randomUUID()) {
    const ts = String(Math.floor(Date.now() / 1000));
    const v1 = createHmac('sha256', WEBHOOK_SECRET).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest('hex');
    return payments.handleWebhook({ 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': requestId } as any, { id: 1, type: 'payment', action: 'payment.updated', data: { id: dataId } }, { 'data.id': dataId, type: 'payment' });
  }
  /** Retry like Mercado Pago does on non-2xx (bounded). */
  async function deliverUntilOk(dataId: string, requestId: string, tries = 200) {
    for (let i = 0; i < tries; i++) {
      try { return await webhook(dataId, requestId); } catch (e: any) { if (process.env.DBDOWN_DEBUG) console.log("retry err", String(e?.message || e).split("\n").slice(-2).join(" ")); await sleep(250); }
    }
    throw new Error(`webhook ${requestId} never succeeded`);
  }
  const effects = async (paymentId: string, orderId: string, productId: string) => ({
    status: (await direct.payment.findUniqueOrThrow({ where: { id: paymentId } })).status,
    paidTransitions: await direct.paymentStateTransition.count({ where: { paymentId, toState: 'PAID' } }),
    captures: await direct.financialLedgerEntry.count({ where: { paymentId, entryType: 'PAYMENT_CAPTURED' } }),
    commits: await direct.inventoryMovement.count({ where: { orderId, kind: 'COMMIT' } }),
    inv: await direct.inventory.findUniqueOrThrow({ where: { productId } }),
    order: (await direct.order.findUniqueOrThrow({ where: { id: orderId } })).status,
  });

  console.log('Scenarios:');
  await scenario('D1', 'Webhook com banco fora → erro (5xx p/ MP), zero efeitos; retry após recuperação aplica 1x', async () => {
    const c = await paidReadyOrder(5);
    fake.setPayment(c.payment.externalId, { status: 'approved', status_detail: 'accredited' });
    await proxy.down();
    const reqId = randomUUID();
    await assert.rejects(() => webhook(c.payment.externalId, reqId), 'must fail while DB is down (MP will retry)');
    let e = await effects(c.payment.id, c.orderId, c.product.id);
    assert.equal(e.status, 'pending'); assert.equal(e.commits, 0); assert.equal(e.captures, 0);
    await proxy.up();
    const t0 = Date.now();
    await deliverUntilOk(c.payment.externalId, reqId); // MP-style redelivery until 2xx
    const recoveredMs = Date.now() - t0;
    await webhook(c.payment.externalId, reqId); // duplicate after recovery
    e = await effects(c.payment.id, c.orderId, c.product.id);
    assert.equal(e.status, 'approved'); assert.equal(e.order, 'paid');
    assert.equal(e.paidTransitions, 1); assert.equal(e.captures, 1); assert.equal(e.commits, 1);
    assert.equal(e.inv.qtyOnHand, 4); assert.equal(e.inv.qtyReserved, 0);
    return `down: rejected, no effects; redelivery succeeded ${recoveredMs}ms after DB returned; paid once, onHand 5→4`;
  });

  await scenario('D2', 'Banco cai no meio de 30 webhooks simultâneos → após recuperação: 1 PAID, 1 captura, 1 baixa', async () => {
    const c = await paidReadyOrder(5);
    fake.setPayment(c.payment.externalId, { status: 'approved', status_detail: 'accredited' });
    // Cut the DB from inside the flow: when Mercado Pago answers the 10th GET for this payment, some
    // deliveries already persisted their PaymentEvent and are about to apply the status.
    let gets = 0;
    fake.beforeSend = async (m, p) => {
      if (m === 'GET' && p.endsWith(`/v1/payments/${c.payment.externalId}`) && ++gets === 10) await proxy.down();
    };
    const ids = Array.from({ length: 30 }, () => randomUUID());
    const outcome = await Promise.all(ids.map((id) => webhook(c.payment.externalId, id).then(() => 'ok', () => 'err')));
    fake.beforeSend = null;
    const persistedBeforeCut = await direct.paymentEvent.count({ where: { providerEventId: { in: ids } } });
    await sleep(300);
    const rec = await recover();
    for (const id of ids) await deliverUntilOk(c.payment.externalId, id); // MP redelivers each notification
    const e = await effects(c.payment.id, c.orderId, c.product.id);
    assert.equal(e.status, 'approved'); assert.equal(e.order, 'paid');
    assert.equal(e.paidTransitions, 1); assert.equal(e.captures, 1); assert.equal(e.commits, 1);
    assert.equal(e.inv.qtyOnHand, 4); assert.equal(e.inv.qtyReserved, 0);
    const failed = outcome.filter((x) => x === 'err').length;
    assert.ok(failed > 0, 'the outage must actually hit some deliveries');
    assert.ok(persistedBeforeCut > 0, 'some deliveries were mid-flow (event persisted) when the DB died');
    return `${persistedBeforeCut} events persisted before the cut, ${failed}/30 deliveries failed; app pool recovered in ${rec}ms; exactly-once (onHand 5→4)`;
  });

  await scenario('D3', 'Banco cai logo após o MP aceitar o estorno → retry com a MESMA chave: 1 estorno no MP, 1 conclusão, 1 devolução ao estoque', async () => {
    const c = await paidReadyOrder(5);
    fake.setPayment(c.payment.externalId, { status: 'approved', status_detail: 'accredited' });
    await webhook(c.payment.externalId);
    let cut = false;
    fake.beforeSend = async (m, p, status) => {
      if (!cut && m === 'POST' && /\/refunds$/.test(p) && status === 201) { cut = true; await proxy.down(); }
    };
    const key = `dbdown-refund-${randomUUID()}`;
    await assert.rejects(() => refunds.requestRefund({ paymentId: c.payment.id, reason: 'cliente desistiu — teste D3', idempotencyKey: key, actorId: admin.id }));
    fake.beforeSend = null;
    assert.equal(cut, true);
    assert.equal((fake.refunds.get(c.payment.externalId) || []).length, 1, 'MP accepted exactly one refund');
    await recover();
    let r = await direct.paymentRefund.findFirstOrThrow({ where: { paymentId: c.payment.id } });
    assert.equal(r.status, 'PROCESSING', 'stuck locally, never assumed complete');
    assert.equal((await direct.payment.findUniqueOrThrow({ where: { id: c.payment.id } })).status, 'approved');
    // Same key again (operator double-click) → replay, no second provider call.
    const replay: any = await refunds.requestRefund({ paymentId: c.payment.id, reason: 'cliente desistiu — teste D3', idempotencyKey: key, actorId: admin.id });
    assert.equal(replay.idempotent, true);
    // Time passes (> 2 min): the operator retries the stuck refund.
    await direct.$executeRawUnsafe(`UPDATE "PaymentRefund" SET "updatedAt" = now() - interval '5 minutes' WHERE "id" = '${r.id}'`);
    await refunds.retry(r.id, admin.id, 'retry após queda do banco — teste D3');
    await assert.rejects(() => refunds.retry(r.id, admin.id, 'segundo retry não deve executar'), (e: any) => e?.response?.code === 'REFUND_NOT_RETRYABLE');
    r = await direct.paymentRefund.findUniqueOrThrow({ where: { id: r.id } });
    assert.equal(r.status, 'COMPLETED');
    assert.equal((fake.refunds.get(c.payment.externalId) || []).length, 1, 'still one provider refund (same X-Idempotency-Key)');
    const refundPosts = fake.calls.filter((x) => x.method === 'POST' && x.path.endsWith('/refunds') && x.path.includes(c.payment.externalId));
    assert.ok(refundPosts.length >= 2 && new Set(refundPosts.map((x) => x.idem)).size === 1, 'retries reused the same idempotency key');
    const e = await effects(c.payment.id, c.orderId, c.product.id);
    assert.equal(e.status, 'refunded');
    assert.equal(await direct.financialLedgerEntry.count({ where: { paymentId: c.payment.id, entryType: 'REFUND_COMPLETED' } }), 1);
    assert.equal(await direct.inventoryMovement.count({ where: { orderId: c.orderId, kind: 'RESTOCK' } }), 1);
    assert.equal(e.inv.qtyOnHand, 5);
    return `provider POSTs=${refundPosts.length} (same key), provider refunds=1, local COMPLETED once, restock once`;
  });

  await scenario('D4', 'Reconciliação durante a queda falha limpa; após recuperação conclui (sem lock preso)', async () => {
    await proxy.down();
    await assert.rejects(() => recon.run({ scope: 'DAILY', withProvider: false, autoRepair: false, triggeredBy: null, origin: 'test' } as any));
    const rec = await recover();
    let res: any = null;
    for (let i = 0; i < 20 && !(res && res.status === 'COMPLETED'); i++) {
      try { res = await recon.run({ scope: 'DAILY', withProvider: false, autoRepair: false, triggeredBy: null, origin: 'test' } as any); } catch { await sleep(250); }
    }
    assert.equal(res?.status, 'COMPLETED', JSON.stringify(res));
    return `during outage: failed cleanly; after recovery (${rec}ms): run ${res.status}`;
  });

  await direct.product.updateMany({ where: { sku: { startsWith: 'OMEGA-DBD-' } }, data: { active: false } });
  await app.close().catch(() => undefined);
  await direct.$disconnect();
  await fake.stop();
  await proxy.down();
  assert.equal(fake.calls.filter((c) => !c.path.startsWith('/v1/')).length, 0);
  const passed = results.filter((r) => r.ok).length;
  console.log(`\nfinance.db-down.db.spec: ${passed} PASS / ${results.length - passed} FAIL (fake provider calls: ${fake.calls.length}, all local TEST)`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => { console.error('finance.db-down.db.spec FATAL', e); process.exit(1); });
