/**
 * SCH-003 — webhook E2E em Postgres LOCAL (PaymentsService real + Nest DI).
 * PAYMENTS_PROVIDER=null apenas como adapter local; domínio/DB são reais.
 * Nunca railway.internal / produção.
 */
import assert from 'assert';
import { NestFactory } from '@nestjs/core';
import { INestApplicationContext } from '@nestjs/common';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma.service';
import { PaymentsService } from './payments.service';
import { randomUUID } from 'crypto';
import * as argon2 from 'argon2';
import {
  nullProviderReset,
  nullProviderSetStatus,
} from './payment.provider';

function assertLocalDb() {
  const url = process.env.DATABASE_URL || '';
  if (!url) throw new Error('DATABASE_URL obrigatória');
  if (/railway|rlwy|\.internal/i.test(url)) {
    throw new Error(`RECUSADO: DATABASE_URL parece produção/Railway`);
  }
  if (!/127\.0\.0\.1|localhost/.test(url)) {
    throw new Error('RECUSADO: DATABASE_URL deve ser localhost/127.0.0.1');
  }
  console.log('DB_SAFE:', url.replace(/:[^:@]+@/, ':***@'));
}


async function reserveForOrder(prisma: PrismaService, productId: string, qty: number) {
  const rows = await prisma.$executeRaw`
    UPDATE "Inventory"
    SET "qtyReserved" = "qtyReserved" + ${qty}
    WHERE "productId" = ${productId}
      AND ("qtyOnHand" - "qtyReserved") >= ${qty}
  `;
  if (rows !== 1) throw new Error(`reserve failed for ${productId} qty=${qty}`);
}

async function main() {
  assertLocalDb();
  process.env.APP_ENV = 'development';
  process.env.NODE_ENV = 'development';
  process.env.PAYMENTS_PROVIDER = 'null';
  process.env.ALLOW_NULL_PAYMENT_SIMULATE = 'true';
  process.env.ALLOW_NULL_PROVIDER_IN_PROD = 'true'; // harness only; APP_ENV=development
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'sch003-access-secret-local-xxxx';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'sch003-refresh-secret-local-xxx';
  delete process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  delete process.env.NULL_WEBHOOK_SECRET;

  nullProviderReset();

  const app: INestApplicationContext = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const prisma = app.get(PrismaService);
  const payments = app.get(PaymentsService);

  const results: Record<string, string> = {};

  const email = `sch003-${randomUUID().slice(0, 8)}@test.local`;
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await argon2.hash('Test1234'),
      name: 'SCH003 Tester',
      role: 'customer',
    },
  });

  let product = await prisma.product.findFirst({
    where: { active: true, price: { gt: 0 } },
    include: { inventory: true },
  });
  if (!product) throw new Error('Sem produto seed — rode prisma seed');
  if (!product.inventory) {
    await prisma.inventory.create({
      data: { productId: product.id, qtyOnHand: 10, qtyReserved: 0 },
    });
  } else {
    await prisma.inventory.update({
      where: { productId: product.id },
      data: { qtyOnHand: Math.max(product.inventory.qtyOnHand, 5), qtyReserved: 0 },
    });
  }

  const amount = Number(product.price);
  const order = await prisma.order.create({
    data: {
      publicId: `SCH-W-${randomUUID().slice(0, 6).toUpperCase()}`,
      userId: user.id,
      status: 'awaiting_payment',
      subtotal: product.price,
      discount: 0,
      freight: 0,
      total: product.price,
      reservationExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      addressSnap: { cep: '91250000', city: 'Porto Alegre', uf: 'RS' },
      items: {
        create: [{ productId: product.id, name: product.name, qty: 1, unitPrice: product.price }],
      },
    },
  });
  await reserveForOrder(prisma, product.id, 1);

  // createIntent via service (idempotent)
  const intentKey = `sch003-intent-${randomUUID()}`;
  const intent = (await payments.createIntent(
    user.id,
    { orderId: order.id, method: 'pix' },
    intentKey,
  )) as any;
  assert.equal(intent.payment.status, 'pending');
  assert.ok(intent.payment.externalId);
  const externalId = intent.payment.externalId as string;
  const paymentId = intent.payment.id;
  console.log('INTENT_OK', { paymentId, externalId: externalId.slice(0, 12) + '…', amount });

  // boleto blocked
  let boletoBlocked = false;
  try {
    await payments.createIntent(user.id, { orderId: order.id, method: 'boleto' as any }, randomUUID());
  } catch (e: any) {
    const code = e?.response?.code || e?.getResponse?.()?.code;
    boletoBlocked = code === 'METHOD_NOT_AVAILABLE' || String(e.message).includes('indisponível');
  }
  assert.equal(boletoBlocked, true);
  results['boleto_blocked'] = 'PASS';

  // signature fail → 401
  let sigFail = false;
  try {
    await payments.handleWebhook(
      { 'x-signature': 'wrong-secret', 'x-request-id': randomUUID() },
      { id: randomUUID(), data: { id: externalId }, status: 'approved', amount },
    );
  } catch (e: any) {
    sigFail = e?.status === 401 || e?.statusCode === 401 || String(e).includes('401');
  }
  assert.equal(sigFail, true);
  results['signature_fail_401'] = 'PASS';

  // approve path (Null store + simulate opt-in)
  nullProviderSetStatus(externalId, 'approved', amount);
  const eventId1 = `evt-approve-${randomUUID()}`;
  const approved = await payments.handleWebhook(
    { 'x-signature': 'null-test-secret', 'x-request-id': eventId1 },
    {
      id: eventId1,
      type: 'payment',
      data: { id: externalId },
      status: 'approved',
      amount,
    },
  );
  assert.equal(approved.applied, true);
  const orderPaid = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  assert.equal(orderPaid.status, 'paid');
  const payApproved = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  assert.equal(payApproved.status, 'approved');
  const ev1 = await prisma.paymentEvent.findFirst({
    where: { providerEventId: eventId1 },
  });
  assert.ok(ev1?.applied);
  results['approve_path'] = 'PASS';
  console.log('APPROVE_PATH PASS order=paid payment=approved');

  // duplicate webhook → ignored
  const dup = await payments.handleWebhook(
    { 'x-signature': 'null-test-secret', 'x-request-id': eventId1 },
    { id: eventId1, type: 'payment', data: { id: externalId }, status: 'approved', amount },
  );
  assert.equal(dup.duplicate, true);
  results['duplicate'] = 'PASS';

  // out-of-order: second event after already paid (refused) must not regress order
  const eventId2 = `evt-ooo-${randomUUID()}`;
  nullProviderSetStatus(externalId, 'refused', amount);
  const ooo = await payments.handleWebhook(
    { 'x-signature': 'null-test-secret', 'x-request-id': eventId2 },
    { id: eventId2, type: 'payment', data: { id: externalId }, status: 'refused', amount },
  );
  const orderAfterOoo = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  assert.equal(orderAfterOoo.status, 'paid', 'order must not regress from paid');
  const payAfterOoo = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  assert.equal(payAfterOoo.status, 'approved', 'approved payment must not become refused');
  results['out_of_order'] = 'PASS';
  console.log('OUT_OF_ORDER PASS', ooo);

  // expire/cancel path on a fresh pending payment/order
  {
    const order2 = await prisma.order.create({
      data: {
        publicId: `SCH-X-${randomUUID().slice(0, 6).toUpperCase()}`,
        userId: user.id,
        status: 'awaiting_payment',
        subtotal: product.price,
        discount: 0,
        freight: 0,
        total: product.price,
        reservationExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
        addressSnap: { cep: '91250000', city: 'POA', uf: 'RS' },
        items: {
          create: [{ productId: product.id, name: product.name, qty: 1, unitPrice: product.price }],
        },
      },
    });
    await reserveForOrder(prisma, product.id, 1);
    const intent2 = (await payments.createIntent(
      user.id,
      { orderId: order2.id, method: 'pix' },
      `sch003-exp-${randomUUID()}`,
    )) as any;
    const ext2 = intent2.payment.externalId as string;
    nullProviderSetStatus(ext2, 'expired', amount);
    const eventExp = `evt-exp-${randomUUID()}`;
    await payments.handleWebhook(
      { 'x-signature': 'null-test-secret', 'x-request-id': eventExp },
      { id: eventExp, type: 'payment', data: { id: ext2 }, status: 'expired', amount },
    );
    const p2 = await prisma.payment.findUniqueOrThrow({ where: { id: intent2.payment.id } });
    assert.equal(p2.status, 'expired');
    const o2 = await prisma.order.findUniqueOrThrow({ where: { id: order2.id } });
    assert.equal(o2.status, 'awaiting_payment', 'expire must NOT cancel order');
    results['expire_no_order_cancel'] = 'PASS';

    // cancel intent path
    const order3 = await prisma.order.create({
      data: {
        publicId: `SCH-C-${randomUUID().slice(0, 6).toUpperCase()}`,
        userId: user.id,
        status: 'awaiting_payment',
        subtotal: product.price,
        discount: 0,
        freight: 0,
        total: product.price,
        reservationExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
        addressSnap: { cep: '91250000', city: 'POA', uf: 'RS' },
        items: {
          create: [{ productId: product.id, name: product.name, qty: 1, unitPrice: product.price }],
        },
      },
    });
    await reserveForOrder(prisma, product.id, 1);
    const intent3 = (await payments.createIntent(
      user.id,
      { orderId: order3.id, method: 'pix' },
      `sch003-can-${randomUUID()}`,
    )) as any;
    const ext3 = intent3.payment.externalId as string;
    nullProviderSetStatus(ext3, 'cancelled', amount);
    const eventCan = `evt-can-${randomUUID()}`;
    await payments.handleWebhook(
      { 'x-signature': 'null-test-secret', 'x-request-id': eventCan },
      { id: eventCan, type: 'payment', data: { id: ext3 }, status: 'cancelled', amount },
    );
    const p3 = await prisma.payment.findUniqueOrThrow({ where: { id: intent3.payment.id } });
    assert.equal(p3.status, 'cancelled');
    results['cancel_path'] = 'PASS';
  }

  // body≠truth: without simulate flag, approved in body must NOT flip store/order
  {
    process.env.ALLOW_NULL_PAYMENT_SIMULATE = 'false';
    const order4 = await prisma.order.create({
      data: {
        publicId: `SCH-B-${randomUUID().slice(0, 6).toUpperCase()}`,
        userId: user.id,
        status: 'awaiting_payment',
        subtotal: product.price,
        discount: 0,
        freight: 0,
        total: product.price,
        reservationExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
        addressSnap: { cep: '91250000', city: 'POA', uf: 'RS' },
        items: {
          create: [{ productId: product.id, name: product.name, qty: 1, unitPrice: product.price }],
        },
      },
    });
    await reserveForOrder(prisma, product.id, 1);
    // recreate app provider state already loaded — set status pending via nullProviderSetStatus after intent
    const intent4 = (await payments.createIntent(
      user.id,
      { orderId: order4.id, method: 'pix' },
      `sch003-body-${randomUUID()}`,
    )) as any;
    const ext4 = intent4.payment.externalId as string;
    // ensure pending in store
    nullProviderSetStatus(ext4, 'pending', amount);
    const eventBody = `evt-body-${randomUUID()}`;
    await payments.handleWebhook(
      { 'x-signature': 'null-test-secret', 'x-request-id': eventBody },
      { id: eventBody, type: 'payment', data: { id: ext4 }, status: 'approved', amount },
    );
    const o4 = await prisma.order.findUniqueOrThrow({ where: { id: order4.id } });
    assert.equal(o4.status, 'awaiting_payment', 'body approved must not mark paid without provider truth');
    results['body_not_truth'] = 'PASS';
    process.env.ALLOW_NULL_PAYMENT_SIMULATE = 'true';
  }

  console.log('SCH003_WEBHOOK_DB_RESULTS', JSON.stringify(results, null, 2));
  console.log('payment.webhook.db.spec PASS');
  await app.close();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
