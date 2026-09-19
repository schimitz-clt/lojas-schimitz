/**
 * Mixed-seller cart → MARKETPLACE_MIXED_CART on order create (local Postgres).
 */
import assert from 'assert';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { OrdersService } from '../orders/orders.service';
import { MARKETPLACE_MIXED_CART } from './mixed-cart';
import { DEFAULT_SELLER_ID, DEFAULT_SELLER_SLUG } from '../sellers/sellers.constants';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('mixed-cart.db.spec SKIP (sem DATABASE_URL)');
    return;
  }
  const url = process.env.DATABASE_URL;
  if (/railway|rlwy|\.internal/i.test(url)) {
    throw new Error('RECUSADO: DATABASE_URL parece produção/Railway');
  }

  process.env.APP_ENV = process.env.APP_ENV || 'development';
  process.env.NODE_ENV = process.env.NODE_ENV || 'development';
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'mixed-cart-access-secret-xxxx';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'mixed-cart-refresh-secret-xxx';
  process.env.PAYMENTS_PROVIDER = process.env.PAYMENTS_PROVIDER || 'null';
  process.env.ALLOW_NULL_PROVIDER_IN_PROD = process.env.ALLOW_NULL_PROVIDER_IN_PROD || 'true';

  const prisma = new PrismaClient();
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const orders = app.get(OrdersService);

  const house = await prisma.seller.upsert({
    where: { slug: DEFAULT_SELLER_SLUG },
    update: { status: 'active' },
    create: {
      id: DEFAULT_SELLER_ID,
      name: 'Lojas Schimitz',
      slug: DEFAULT_SELLER_SLUG,
      status: 'active',
    },
  });
  const tag = randomUUID().slice(0, 8);
  const partner = await prisma.seller.create({
    data: {
      name: `Parceiro ${tag}`,
      slug: `parceiro-mix-${tag}`,
      status: 'active',
    },
  });

  const user = await prisma.user.create({
    data: {
      email: `mix-${tag}@test.local`,
      passwordHash: 'x',
      name: 'Mix Cart',
      role: 'customer',
    },
  });
  const address = await prisma.address.create({
    data: {
      userId: user.id,
      cep: '91250000',
      street: 'Rua Teste',
      number: '1',
      district: 'Centro',
      city: 'Porto Alegre',
      uf: 'RS',
    },
  });

  const pHouse = await prisma.product.create({
    data: {
      sku: `MIX-H-${tag}`,
      name: 'House SKU',
      slug: `mix-h-${tag}`,
      price: 10,
      active: true,
      sellerId: house.id,
      inventory: { create: { qtyOnHand: 5, qtyReserved: 0 } },
    },
  });
  const pPartner = await prisma.product.create({
    data: {
      sku: `MIX-P-${tag}`,
      name: 'Partner SKU',
      slug: `mix-p-${tag}`,
      price: 12,
      active: true,
      sellerId: partner.id,
      inventory: { create: { qtyOnHand: 5, qtyReserved: 0 } },
    },
  });

  const cart = await prisma.cart.create({
    data: {
      userId: user.id,
      items: {
        create: [
          { productId: pHouse.id, qty: 1 },
          { productId: pPartner.id, qty: 1 },
        ],
      },
    },
  });

  let mixedCode = '';
  try {
    await orders.create(user.id, { addressId: address.id }, randomUUID());
  } catch (e: unknown) {
    const res = (e as { getResponse?: () => { code?: string } }).getResponse?.();
    mixedCode = String(res?.code || (e as { code?: string }).code || '');
  }
  assert.equal(mixedCode, MARKETPLACE_MIXED_CART, 'mixed cart must be rejected at checkout');

  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } }).catch(() => undefined);
  await prisma.cart.delete({ where: { id: cart.id } }).catch(() => undefined);
  await prisma.inventory.deleteMany({ where: { productId: { in: [pHouse.id, pPartner.id] } } }).catch(() => undefined);
  await prisma.product.deleteMany({ where: { id: { in: [pHouse.id, pPartner.id] } } }).catch(() => undefined);
  await prisma.address.delete({ where: { id: address.id } }).catch(() => undefined);
  await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
  await prisma.seller.delete({ where: { id: partner.id } }).catch(() => undefined);

  await app.close();
  await prisma.$disconnect();
  console.log('mixed-cart.db.spec ok');
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
