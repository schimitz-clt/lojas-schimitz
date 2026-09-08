/**
 * PIX 5% backend authority — createIntent amount on LOCAL Postgres (null provider).
 */
import assert from 'assert';
import { NestFactory } from '@nestjs/core';
import { INestApplicationContext } from '@nestjs/common';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { pixChargeAmount } from '../../common/pricing';
import { randomUUID } from 'crypto';
import * as argon2 from 'argon2';

function assertLocalDb() {
  const url = process.env.DATABASE_URL || '';
  if (!url) throw new Error('DATABASE_URL obrigatória');
  if (/railway|rlwy|\.internal/i.test(url)) throw new Error('RECUSADO: DATABASE_URL parece produção/Railway');
  if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error('RECUSADO: DATABASE_URL deve ser localhost/127.0.0.1');
  console.log('DB_SAFE:', url.replace(/:[^:@]+@/, ':***@'));
}

async function main() {
  assertLocalDb();
  process.env.APP_ENV = 'development';
  process.env.NODE_ENV = 'development';
  process.env.PAYMENTS_PROVIDER = 'null';
  process.env.ALLOW_NULL_PAYMENT_SIMULATE = 'true';
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'sch004-access-secret-local-xxxx';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'sch004-refresh-secret-local-xxx';

  const app: INestApplicationContext = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const payments = app.get(PaymentsService);

  const seller = await prisma.seller.upsert({
    where: { slug: 'lojas-schimitz' },
    update: {},
    create: { id: '00000000-0000-4000-8000-000000000001', name: 'Lojas Schimitz', slug: 'lojas-schimitz', status: 'active' },
  });
  const sku = `TMP-PIX-${randomUUID().slice(0, 6)}`;
  const product = await prisma.product.create({
    data: {
      sku, name: 'PIX disc', slug: sku.toLowerCase(), description: 't', price: 100, active: true, sellerId: seller.id,
      inventory: { create: { qtyOnHand: 5, qtyReserved: 1 } },
    },
  });
  const user = await prisma.user.create({
    data: {
      email: `pix-${randomUUID().slice(0, 8)}@lojas-schimitz.test`,
      name: 'Pix User', passwordHash: await argon2.hash('PixPass12'), role: 'customer', status: 'active',
    },
  });
  const order = await prisma.order.create({
    data: {
      publicId: `SCH-PIX-${randomUUID().slice(0, 6).toUpperCase()}`,
      userId: user.id,
      status: 'awaiting_payment',
      subtotal: 100,
      discount: 0,
      freight: 0,
      total: 100,
      addressSnap: { cep: '90000000', city: 'Porto Alegre', uf: 'RS' },
      reservationExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      items: { create: [{ productId: product.id, sellerId: seller.id, name: product.name, qty: 1, unitPrice: 100 }] },
    },
  });

  try {
    const pix = await payments.createIntent(user.id, { orderId: order.id, method: 'pix' }, randomUUID());
    assert.equal(Number((pix as any).payment.amount), pixChargeAmount(100));
    assert.equal(Number((pix as any).payment.amount), 95);

    const cardOrder = await prisma.order.create({
      data: {
        publicId: `SCH-CARD-${randomUUID().slice(0, 6).toUpperCase()}`,
        userId: user.id,
        status: 'awaiting_payment',
        subtotal: 100,
        discount: 0,
        freight: 0,
        total: 100,
        addressSnap: { cep: '90000000', city: 'Porto Alegre', uf: 'RS' },
        reservationExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
        items: { create: [{ productId: product.id, sellerId: seller.id, name: product.name, qty: 1, unitPrice: 100 }] },
      },
    });
    const card = await payments.createIntent(user.id, { orderId: cardOrder.id, method: 'card', cardToken: 'tok_test' }, randomUUID());
    assert.equal(Number((card as any).payment.amount), 100);

    // Cleanup card order payments
    await prisma.payment.deleteMany({ where: { orderId: cardOrder.id } });
    await prisma.orderItem.deleteMany({ where: { orderId: cardOrder.id } });
    await prisma.idempotencyRecord.deleteMany({ where: { userId: user.id } });
    await prisma.order.delete({ where: { id: cardOrder.id } });

    console.log('pix-discount.db.spec PASS');
  } finally {
    await prisma.payment.deleteMany({ where: { orderId: order.id } });
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.idempotencyRecord.deleteMany({ where: { userId: user.id } });
    await prisma.order.delete({ where: { id: order.id } }).catch(() => undefined);
    await prisma.inventory.deleteMany({ where: { productId: product.id } });
    await prisma.product.delete({ where: { id: product.id } }).catch(() => undefined);
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    await app.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

