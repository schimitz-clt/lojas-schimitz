/**
 * Integração Postgres — Notification create/list/mark-read.
 * Requer DATABASE_URL + migration SCH-007 aplicada.
 * Se a tabela ainda não existir, SKIP (não falha o CI local pré-migrate).
 */
import assert from 'assert';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function tableReady() {
  try {
    await prisma.$queryRaw`SELECT 1 FROM "Notification" LIMIT 1`;
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('notifications.db.spec SKIP (sem DATABASE_URL)');
    return;
  }
  if (!(await tableReady())) {
    console.log('notifications.db.spec SKIP (tabela Notification ausente — rode migrate deploy)');
    await prisma.$disconnect();
    return;
  }

  const email = `notif-${randomUUID().slice(0, 8)}@test.local`;
  const user = await prisma.user.create({
    data: { email, passwordHash: 'x', name: 'Notif Test', role: 'customer' },
  });

  try {
    const n1 = await prisma.notification.create({
      data: {
        userId: user.id,
        type: 'order_paid',
        title: 'Pedido pago',
        body: 'teste',
        linkUrl: '/pedidos/SCH-X',
      },
    });
    const n2 = await prisma.notification.create({
      data: {
        userId: user.id,
        type: 'order_status',
        title: 'Pedido: Em trânsito',
        body: 'status',
      },
    });

    const list = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    assert.equal(list.length, 2);
    assert.equal(list[0].id, n2.id);

    const unread = await prisma.notification.count({ where: { userId: user.id, readAt: null } });
    assert.equal(unread, 2);

    await prisma.notification.update({ where: { id: n1.id }, data: { readAt: new Date() } });
    const unread2 = await prisma.notification.count({ where: { userId: user.id, readAt: null } });
    assert.equal(unread2, 1);

    await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    const unread3 = await prisma.notification.count({ where: { userId: user.id, readAt: null } });
    assert.equal(unread3, 0);

    console.log('notifications.db postgres tests ok');
  } finally {
    await prisma.notification.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
