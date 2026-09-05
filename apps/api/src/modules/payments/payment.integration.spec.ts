/**
 * Integração leve Postgres + NullPaymentProvider (sem Nest HTTP).
 * Requer DATABASE_URL apontando para lojas_schimitz.
 */
import assert from 'assert';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  NullPaymentProvider,
  nullProviderReset,
  nullProviderSetStatus,
} from './payment.provider';

const prisma = new PrismaClient();

async function main() {
  nullProviderReset();
  const provider = new NullPaymentProvider();

  const email = `pay-int-${randomUUID().slice(0, 8)}@test.local`;
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: 'x',
      name: 'Pay Int',
      role: 'customer',
    },
  });

  const product = await prisma.product.findFirst({ include: { inventory: true } });
  assert.ok(product, 'precisa de produto seed');

  const order = await prisma.order.create({
    data: {
      publicId: `SCH-PAY-${randomUUID().slice(0, 6)}`,
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

  const payment = await prisma.payment.create({
    data: {
      orderId: order.id,
      provider: 'null',
      method: 'pix',
      status: 'pending',
      amount: order.total,
    },
  });

  let dupFailed = false;
  try {
    await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: 'null',
        method: 'card',
        status: 'pending',
        amount: order.total,
      },
    });
  } catch {
    dupFailed = true;
  }
  assert.equal(dupFailed, true, 'unique parcial pending deve falhar');

  const remote = await provider.createIntent({
    orderId: order.id,
    publicId: order.publicId,
    method: 'pix',
    amount: Number(order.total),
  });
  await prisma.payment.update({
    where: { id: payment.id },
    data: { externalId: remote.externalId, payload: remote.payload as object },
  });

  const eventId = `evt-${randomUUID()}`;
  await prisma.paymentEvent.create({
    data: {
      provider: 'null',
      providerEventId: eventId,
      paymentId: payment.id,
      topic: 'payment',
      payload: { data: { id: remote.externalId } },
      applied: false,
    },
  });

  nullProviderSetStatus(remote.externalId, 'approved', Number(order.total));
  const fetched = await provider.fetchPayment(remote.externalId);
  assert.equal(fetched.status, 'approved');

  await prisma.payment.update({ where: { id: payment.id }, data: { status: 'approved' } });
  const rows = await prisma.$executeRaw`
    UPDATE "Order"
    SET "status" = 'paid'::"OrderStatus", "reservationExpiresAt" = NULL
    WHERE "id" = ${order.id} AND "status" = 'awaiting_payment'::"OrderStatus"
  `;
  assert.equal(rows, 1);

  const ev = await prisma.paymentEvent.findFirstOrThrow({ where: { providerEventId: eventId } });
  await prisma.paymentEvent.update({ where: { id: ev.id }, data: { applied: true } });

  let replayDup = false;
  try {
    await prisma.paymentEvent.create({
      data: {
        provider: 'null',
        providerEventId: eventId,
        payload: {},
      },
    });
  } catch {
    replayDup = true;
  }
  assert.equal(replayDup, true);

  const finalOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  assert.equal(finalOrder.status, 'paid');

  await prisma.paymentEvent.deleteMany({ where: { paymentId: payment.id } });
  await prisma.payment.deleteMany({ where: { orderId: order.id } });
  await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
  await prisma.order.delete({ where: { id: order.id } });
  await prisma.user.delete({ where: { id: user.id } });

  console.log('payment.integration postgres tests ok');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
