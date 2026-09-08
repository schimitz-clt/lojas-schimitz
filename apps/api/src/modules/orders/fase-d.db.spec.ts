/**
 * SCH-002.1 FASE D — validação real em Postgres local.
 * Requer DATABASE_URL apontando APENAS para DB local de teste.
 * Nunca usar railway.internal / produção.
 */
import assert from 'assert';
import { NestFactory } from '@nestjs/core';
import { INestApplicationContext } from '@nestjs/common';
import { AppModule } from '../../app.module';
import { OrdersService } from './orders.service';
import { ReservationsExpiryService } from './reservations-expiry.service';
import { PrismaService } from '../../prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { randomUUID } from 'crypto';
import * as argon2 from 'argon2';

function assertLocalDb() {
  const url = process.env.DATABASE_URL || '';
  if (!url) throw new Error('DATABASE_URL obrigatória');
  if (/railway|rlwy|\.internal|prod/i.test(url)) {
    throw new Error(`RECUSADO: DATABASE_URL parece produção/Railway: ${url.replace(/:[^:@]+@/, ':***@')}`);
  }
  if (!/127\.0\.0\.1|localhost/.test(url)) {
    throw new Error(`RECUSADO: DATABASE_URL deve ser localhost/127.0.0.1, got host check fail`);
  }
  console.log('DB_SAFE: local', url.replace(/:[^:@]+@/, ':***@'));
}

async function setupUser(prisma: PrismaService, tag: string) {
  const email = `fase-d-${tag}-${randomUUID().slice(0, 8)}@test.local`;
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await argon2.hash('test-pass-fase-d'),
      name: `Fase D ${tag}`,
      role: 'customer',
      status: 'active',
      phone: '51999999999',
    },
  });
  const address = await prisma.address.create({
    data: {
      userId: user.id,
      label: 'Casa',
      cep: '91250000',
      street: 'Rua Teste',
      number: '100',
      district: 'Centro',
      city: 'Porto Alegre',
      uf: 'RS',
    },
  });
  return { user, address };
}

async function ensureProductWithStock(prisma: PrismaService, qtyOnHand: number, skuPrefix: string) {
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
  const sku = `${skuPrefix}-${randomUUID().slice(0, 8)}`;
  const product = await prisma.product.create({
    data: {
      sku,
      name: `Fase D ${sku}`,
      slug: sku.toLowerCase(),
      description: 'fase-d test product',
      price: 10,
      active: true,
      sellerId: seller.id,
      inventory: { create: { qtyOnHand, qtyReserved: 0 } },
    },
    include: { inventory: true },
  });
  return product;
}

async function putCart(prisma: PrismaService, userId: string, productId: string, qty: number) {
  let cart = await prisma.cart.findFirst({ where: { userId } });
  if (!cart) cart = await prisma.cart.create({ data: { userId } });
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  await prisma.cartItem.create({ data: { cartId: cart.id, productId, qty } });
  return cart;
}

async function main() {
  assertLocalDb();
  process.env.PAYMENTS_PROVIDER = process.env.PAYMENTS_PROVIDER || 'null';
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret-fase-d-xxxxxxxx';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-fase-d-xxxxxxx';

  const app: INestApplicationContext = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const orders = app.get(OrdersService);
  const prisma = app.get(PrismaService);
  const inventory = app.get(InventoryService);

  const results: Record<string, string> = {};

  // -------------------------------------------------------------------------
  // 4) Real concurrency: two parallel order creates racing last unit (CAS)
  // -------------------------------------------------------------------------
  {
    const product = await ensureProductWithStock(prisma, 1, 'CAS-RACE');
    const a = await setupUser(prisma, 'race-a');
    const b = await setupUser(prisma, 'race-b');
    await putCart(prisma, a.user.id, product.id, 1);
    await putCart(prisma, b.user.id, product.id, 1);

    const keyA = `idem-race-a-${randomUUID().slice(0, 8)}`;
    const keyB = `idem-race-b-${randomUUID().slice(0, 8)}`;

    const settled = await Promise.allSettled([
      orders.create(a.user.id, { addressId: a.address.id }, keyA),
      orders.create(b.user.id, { addressId: b.address.id }, keyB),
    ]);

    const wins = settled.filter((s) => s.status === 'fulfilled');
    const fails = settled.filter((s) => s.status === 'rejected');
    assert.equal(wins.length, 1, `expected exactly 1 win, got ${wins.length}`);
    assert.equal(fails.length, 1, `expected exactly 1 fail, got ${fails.length}`);

    const failReason = (fails[0] as PromiseRejectedResult).reason;
    const code = failReason?.response?.code || failReason?.getResponse?.()?.code || failReason?.message;
    assert.ok(
      String(code).includes('INSUFFICIENT_STOCK') || String(failReason).includes('INSUFFICIENT_STOCK'),
      `fail should be INSUFFICIENT_STOCK, got ${code}`,
    );

    const inv = await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } });
    assert.equal(inv.qtyOnHand, 1);
    assert.equal(inv.qtyReserved, 1);
    assert.ok(inv.qtyReserved >= 0 && inv.qtyOnHand >= inv.qtyReserved, 'no negative / oversell');

    const orderCount = await prisma.order.count({
      where: { items: { some: { productId: product.id } }, status: 'awaiting_payment' },
    });
    assert.equal(orderCount, 1);
    console.log('FASE_D_4 concurrency CAS race: PASS (1 win, 1 INSUFFICIENT_STOCK, reserved=1 onHand=1)');
    results['4_concurrency_cas'] = 'PASS';
  }

  // -------------------------------------------------------------------------
  // 5) Real reservation expiry
  // -------------------------------------------------------------------------
  {
    const product = await ensureProductWithStock(prisma, 3, 'EXP');
    const u = await setupUser(prisma, 'exp');
    await putCart(prisma, u.user.id, product.id, 2);
    const key = `idem-exp-${randomUUID().slice(0, 8)}`;
    const order = (await orders.create(u.user.id, { addressId: u.address.id }, key)) as any;
    assert.equal(order.status, 'awaiting_payment');

    let inv = await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } });
    assert.equal(inv.qtyReserved, 2);
    assert.equal(inv.qtyOnHand, 3);

    // Force past expiresAt
    await prisma.order.update({
      where: { id: order.id },
      data: { reservationExpiresAt: new Date(Date.now() - 60_000) },
    });

    // Job path: ReservationsExpiryService.tick -> expireReservations
    const job = app.get(ReservationsExpiryService);
    const expired = await job.tick();
    assert.equal((expired as any).skipped, false);
    assert.ok((expired as any).expired >= 1, `expected >=1 expired via job, got ${(expired as any).expired}`);

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    assert.equal(after.status, 'cancelled');
    assert.equal(after.reservationExpiresAt, null);

    inv = await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } });
    assert.equal(inv.qtyOnHand, 3);
    assert.equal(inv.qtyReserved, 0);
    console.log('FASE_D_5 reservation expiry: PASS (cancelled + stock released)');
    results['5_reservation_expiry'] = 'PASS';
  }

  // -------------------------------------------------------------------------
  // 6) Idempotency-Key: same payload replay + different payload conflict
  // -------------------------------------------------------------------------
  {
    const product = await ensureProductWithStock(prisma, 10, 'IDEM');
    const u = await setupUser(prisma, 'idem');
    await putCart(prisma, u.user.id, product.id, 1);
    const key = `idemkey-${randomUUID().slice(0, 12)}`;

    const first = (await orders.create(u.user.id, { addressId: u.address.id }, key)) as any;
    assert.ok(first.id);
    assert.equal(first.status, 'awaiting_payment');

    // Same key + same payload (cart emptied by first create — service replays via order/idempotency record)
    const second = (await orders.create(u.user.id, { addressId: u.address.id }, key)) as any;
    assert.equal(second.id, first.id, 'same key+payload must return same order id');

    // Different payload hash (outro addressId) com mesma key → conflict
    const otherAddress = await prisma.address.create({
      data: {
        userId: u.user.id,
        label: 'Trabalho',
        cep: '90010000',
        street: 'Outra Rua',
        number: '200',
        district: 'Centro',
        city: 'Porto Alegre',
        uf: 'RS',
      },
    });
    let conflict = false;
    let conflictCode = '';
    try {
      await orders.create(u.user.id, { addressId: otherAddress.id }, key);
    } catch (e: any) {
      conflict = true;
      conflictCode = e?.response?.code || e?.getResponse?.()?.code || e?.message || '';
    }
    assert.equal(conflict, true, 'expected IDEMPOTENCY_KEY_REUSED');
    assert.ok(String(conflictCode).includes('IDEMPOTENCY_KEY_REUSED'), `got ${conflictCode}`);

    const inv = await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } });
    // Only first order reserved 1 unit
    assert.equal(inv.qtyReserved, 1);
    assert.equal(inv.qtyOnHand, 10);
    console.log('FASE_D_6 idempotency: PASS (replay same id + conflict on different payload)');
    results['6_idempotency'] = 'PASS';
  }

  // -------------------------------------------------------------------------
  // 7) Rollback / failure path: reserve fails mid-flow → no orphan order / stock
  // -------------------------------------------------------------------------
  {
    const product = await ensureProductWithStock(prisma, 1, 'RB');
    // Pre-reserve the only unit via InventoryService so create will fail at CAS
    await prisma.$transaction(async (tx) => {
      await inventory.reserve(tx, product.id, 1);
    });
    const inv0 = await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } });
    assert.equal(inv0.qtyReserved, 1);

    const u = await setupUser(prisma, 'rb');
    await putCart(prisma, u.user.id, product.id, 1);
    const key = `idem-rb-${randomUUID().slice(0, 8)}`;

    let failed = false;
    try {
      await orders.create(u.user.id, { addressId: u.address.id }, key);
    } catch (e: any) {
      failed = true;
      const code = e?.response?.code || e?.getResponse?.()?.code || '';
      assert.ok(String(code).includes('INSUFFICIENT_STOCK') || String(e.message || '').includes('estoque'), String(code || e));
    }
    assert.equal(failed, true);

    // Preflight may catch before tx, or CAS inside tx rolls back — either way no awaiting order for this key
    const orphan = await prisma.order.findFirst({
      where: { userId: u.user.id, idempotencyKey: key },
    });
    assert.equal(orphan, null, 'no order should persist after failed create');

    const inv = await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } });
    assert.equal(inv.qtyOnHand, 1);
    assert.equal(inv.qtyReserved, 1); // only the pre-reserve remains
    assert.ok(inv.qtyReserved >= 0);

    // Release pre-reserve for cleanliness
    await prisma.$transaction(async (tx) => {
      await inventory.release(tx, product.id, 1);
    });
    console.log('FASE_D_7 rollback/failure: PASS (no orphan order, stock not oversold)');
    results['7_rollback_failure'] = 'PASS';
  }

  // -------------------------------------------------------------------------
  // Extra: InventoryService CAS parallel raw (defense in depth)
  // -------------------------------------------------------------------------
  {
    const product = await ensureProductWithStock(prisma, 1, 'RAW');
    const attempts = await Promise.all(
      [1, 2, 3, 4].map(() =>
        prisma.$transaction(async (tx) => {
          try {
            await inventory.reserve(tx, product.id, 1);
            return true;
          } catch {
            return false;
          }
        }),
      ),
    );
    assert.equal(attempts.filter(Boolean).length, 1);
    const inv = await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } });
    assert.equal(inv.qtyReserved, 1);
    assert.equal(inv.qtyOnHand, 1);
    console.log('FASE_D_extra InventoryService parallel CAS: PASS');
    results['extra_inv_parallel_cas'] = 'PASS';
  }

  console.log('\n=== FASE D DB VALIDATION SUMMARY ===');
  for (const [k, v] of Object.entries(results)) {
    console.log(`  ${k}: ${v}`);
  }
  console.log('FASE_D_ALL_REQUIRED_DB_PATHS: PASS');

  await app.close();
}

main().catch((e) => {
  console.error('FASE_D_FAIL', e);
  process.exit(1);
});
