/**
 * Admin customers CRM — Postgres LOCAL only.
 * Never railway.internal / produção.
 */
import assert from 'assert';
import { NestFactory } from '@nestjs/core';
import { INestApplicationContext, NotFoundException } from '@nestjs/common';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma.service';
import { AdminCustomersService } from './admin-customers.service';
import { randomUUID } from 'crypto';
import * as argon2 from 'argon2';

function assertLocalDb() {
  const url = process.env.DATABASE_URL || '';
  if (!url) throw new Error('DATABASE_URL obrigatória');
  if (/railway|rlwy|\.internal/i.test(url)) {
    throw new Error('RECUSADO: DATABASE_URL parece produção/Railway');
  }
  if (!/127\.0\.0\.1|localhost/.test(url)) {
    throw new Error('RECUSADO: DATABASE_URL deve ser localhost/127.0.0.1');
  }
  console.log('DB_SAFE:', url.replace(/:[^:@]+@/, ':***@'));
}

async function main() {
  assertLocalDb();
  process.env.APP_ENV = 'development';
  process.env.NODE_ENV = 'development';
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'sch005-access-secret-local-xxxx';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'sch005-refresh-secret-local-xxx';
  process.env.PAYMENTS_PROVIDER = 'null';

  const app: INestApplicationContext = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const prisma = app.get(PrismaService);
  const customers = app.get(AdminCustomersService);

  const suffix = randomUUID().slice(0, 8);
  const email = `crm-${suffix}@lojas-schimitz.test`;
  const passwordHash = await argon2.hash('CrmPass123');

  const seller = await prisma.seller.upsert({
    where: { slug: 'lojas-schimitz' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Lojas Schimitz',
      slug: 'lojas-schimitz',
      status: 'active',
    },
  });

  const sku = `CRM-${suffix}`;
  const product = await prisma.product.create({
    data: {
      sku,
      name: `Prod CRM ${suffix}`,
      slug: sku.toLowerCase(),
      description: 'crm test',
      price: 100,
      active: true,
      sellerId: seller.id,
      inventory: { create: { qtyOnHand: 10, qtyReserved: 0 } },
    },
  });

  const user = await prisma.user.create({
    data: {
      email,
      name: `Cliente CRM ${suffix}`,
      phone: '51988887777',
      passwordHash,
      role: 'customer',
      status: 'active',
    },
  });

  const order = await prisma.order.create({
    data: {
      publicId: `SCH-CRM-${suffix}`,
      userId: user.id,
      status: 'paid',
      subtotal: 100,
      discount: 0,
      freight: 10,
      total: 110,
      items: {
        create: [
          {
            productId: product.id,
            name: 'Item CRM',
            qty: 1,
            unitPrice: 100,
          },
        ],
      },
    },
  });

  let adminId: string | null = null;
  try {
    const listed = await customers.list({ q: suffix, take: 20 });
    assert.ok(listed.total >= 1);
    const row = listed.items.find((i) => i.id === user.id);
    assert.ok(row, 'customer in list');
    assert.equal(row!.ordersCount, 1);
    assert.equal(row!.paidOrdersCount, 1);
    assert.equal(row!.paidTotal, 110);
    assert.ok(row!.lastPaidAt);

    const byPhone = await customers.list({ q: '5198888' });
    assert.ok(byPhone.items.some((i) => i.id === user.id));

    const detail = await customers.getById(user.id);
    assert.equal(detail.email, email);
    assert.equal(detail.orders.length, 1);
    assert.equal(detail.orders[0].publicId, order.publicId);
    assert.equal(detail.paidTotal, 110);
    assert.equal((detail as any).passwordHash, undefined);

    const admin = await prisma.user.create({
      data: {
        email: `admin-crm-${suffix}@lojas-schimitz.test`,
        name: 'Admin CRM',
        passwordHash,
        role: 'admin',
        status: 'active',
      },
    });
    adminId = admin.id;
    try {
      await customers.getById(admin.id);
      assert.fail('admin should 404 as customer');
    } catch (e) {
      assert.ok(e instanceof NotFoundException);
    }

    console.log('admin-customers.db.spec PASS');
  } finally {
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } }).catch(() => undefined);
    await prisma.order.delete({ where: { id: order.id } }).catch(() => undefined);
    await prisma.inventory.deleteMany({ where: { productId: product.id } }).catch(() => undefined);
    await prisma.product.delete({ where: { id: product.id } }).catch(() => undefined);
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    if (adminId) await prisma.user.delete({ where: { id: adminId } }).catch(() => undefined);
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
