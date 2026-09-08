/**
 * Guest cart merge on login — Postgres LOCAL only.
 */
import assert from 'assert';
import { NestFactory } from '@nestjs/core';
import { INestApplicationContext } from '@nestjs/common';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma.service';
import { AuthService } from '../auth/auth.service';
import { CartService } from './cart.service';
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
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'sch004-access-secret-local-xxxx';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'sch004-refresh-secret-local-xxx';

  const app: INestApplicationContext = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const prisma = app.get(PrismaService);
  const auth = app.get(AuthService);
  const cart = app.get(CartService);

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

  const skuA = `TMP-MERGE-A-${randomUUID().slice(0, 6)}`;
  const skuB = `TMP-MERGE-B-${randomUUID().slice(0, 6)}`;
  const skuInactive = `TMP-MERGE-X-${randomUUID().slice(0, 6)}`;

  const productA = await prisma.product.create({
    data: {
      sku: skuA,
      name: 'Merge A',
      slug: skuA.toLowerCase(),
      description: 't',
      price: 50,
      active: true,
      sellerId: seller.id,
      inventory: { create: { qtyOnHand: 5, qtyReserved: 0 } },
    },
  });
  const productB = await prisma.product.create({
    data: {
      sku: skuB,
      name: 'Merge B',
      slug: skuB.toLowerCase(),
      description: 't',
      price: 30,
      active: true,
      sellerId: seller.id,
      inventory: { create: { qtyOnHand: 2, qtyReserved: 0 } },
    },
  });
  const productInactive = await prisma.product.create({
    data: {
      sku: skuInactive,
      name: 'Merge Inactive',
      slug: skuInactive.toLowerCase(),
      description: 't',
      price: 10,
      active: false,
      sellerId: seller.id,
      inventory: { create: { qtyOnHand: 10, qtyReserved: 0 } },
    },
  });

  const email = `merge-${randomUUID().slice(0, 8)}@lojas-schimitz.test`;
  const password = 'MergePass1';
  const user = await prisma.user.create({
    data: {
      email,
      name: 'Merge User',
      passwordHash: await argon2.hash(password),
      role: 'customer',
      status: 'active',
    },
  });

  const guestToken = randomUUID();
  try {
    // User already has product A qty 1
    await cart.addItem({ productId: productA.id, qty: 1 }, user.id);

    // Guest has A qty 2, B qty 5 (stock only 2 → cap), inactive qty 1 (drop)
    await cart.addItem({ productId: productA.id, qty: 2 }, undefined, guestToken);
    await cart.addItem({ productId: productB.id, qty: 2 }, undefined, guestToken);
    // Force overstock + inactive into guest cart (bypass addItem guards)
    const guestCart = await prisma.cart.findFirst({ where: { guestToken } });
    assert.ok(guestCart);
    const bItem = await prisma.cartItem.findFirst({
      where: { cartId: guestCart!.id, productId: productB.id },
    });
    assert.ok(bItem);
    await prisma.cartItem.update({ where: { id: bItem!.id }, data: { qty: 5 } });
    await prisma.cartItem.create({
      data: { cartId: guestCart!.id, productId: productInactive.id, qty: 1 },
    });

    // Login then merge guest cart (same as AuthController)
    await auth.login({ email, password }, '127.0.0.1', guestToken);
    await cart.mergeGuestIntoUser(user.id, guestToken);

    const merged = await cart.getCart(user.id);
    const byPid = Object.fromEntries(merged.items.map((i) => [i.productId, i]));

    // A: 1+2=3, stock 5 → 3
    assert.equal(byPid[productA.id]?.qty, 3);
    // B: capped to stock 2
    assert.equal(byPid[productB.id]?.qty, 2);
    // Inactive dropped
    assert.equal(byPid[productInactive.id], undefined);

    // Prices come from product (revalidated)
    assert.equal(byPid[productA.id]?.price, 50);
    assert.equal(byPid[productB.id]?.price, 30);

    // Guest cart gone
    const guestLeft = await prisma.cart.findFirst({ where: { guestToken } });
    assert.equal(guestLeft, null);

    console.log('cart-merge.db.spec PASS');
  } finally {
    await prisma.cartItem.deleteMany({
      where: { productId: { in: [productA.id, productB.id, productInactive.id] } },
    });
    await prisma.cart.deleteMany({ where: { userId: user.id } });
    await prisma.cart.deleteMany({ where: { guestToken } }).catch(() => undefined);
    await prisma.inventory.deleteMany({
      where: { productId: { in: [productA.id, productB.id, productInactive.id] } },
    });
    await prisma.product.deleteMany({
      where: { id: { in: [productA.id, productB.id, productInactive.id] } },
    });
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
