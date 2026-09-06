/**
 * Commission ledger: recordOnPaid + approve/paid transitions (Repasse v1).
 * Requer DATABASE_URL + migrations SCH-009/SCH-010.
 */
import assert from 'assert';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { canTransitionCommission, commissionAmount, resolveCommissionPercent } from './commissions.constants';
import { sellerOwnsCommission } from './commissions.authz';
import { DEFAULT_SELLER_ID, DEFAULT_SELLER_SLUG } from '../sellers/sellers.constants';

const prisma = new PrismaClient();

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('commissions.db.spec SKIP (sem DATABASE_URL)');
    return;
  }

  try {
    await prisma.$queryRaw`SELECT 1 FROM "CommissionLedger" LIMIT 1`;
  } catch {
    console.log('commissions.db.spec SKIP (CommissionLedger ausente — rode migrate)');
    return;
  }

  // Detect SCH-010 columns
  let hasPayoutCols = false;
  try {
    await prisma.$queryRaw`SELECT "payoutReference", "approvedAt", "paidAt" FROM "CommissionLedger" LIMIT 0`;
    hasPayoutCols = true;
  } catch {
    console.log('commissions.db.spec WARN (SCH-010 cols ausentes — transitions skippadas)');
  }

  const def = await prisma.seller.upsert({
    where: { slug: DEFAULT_SELLER_SLUG },
    update: { commissionPercent: 10, status: 'active' },
    create: {
      id: DEFAULT_SELLER_ID,
      name: 'Lojas Schimitz',
      slug: DEFAULT_SELLER_SLUG,
      status: 'active',
      commissionPercent: 10,
    },
  });

  const other = await prisma.seller.upsert({
    where: { slug: 'tmp-other-com-seller' },
    update: { status: 'active' },
    create: {
      name: 'Temp Other Seller',
      slug: 'tmp-other-com-seller',
      status: 'active',
      commissionPercent: 10,
    },
  });

  const sku = `TMP-COM-${randomUUID().slice(0, 8)}`;
  const product = await prisma.product.create({
    data: {
      sku,
      name: 'Temp commission product',
      slug: sku.toLowerCase(),
      description: 'temp',
      price: 100,
      active: false,
      sellerId: def.id,
    },
  });

  const user = await prisma.user.create({
    data: {
      email: `com-${randomUUID().slice(0, 8)}@test.local`,
      passwordHash: 'x',
      name: 'Com Test',
      role: 'customer',
    },
  });

  const order = await prisma.order.create({
    data: {
      publicId: `SCH-COM-${randomUUID().slice(0, 6)}`,
      userId: user.id,
      status: 'paid',
      subtotal: 100,
      discount: 0,
      freight: 0,
      total: 100,
      items: {
        create: [
          {
            productId: product.id,
            sellerId: def.id,
            name: product.name,
            qty: 2,
            unitPrice: 50,
          },
        ],
      },
    },
    include: { items: true },
  });

  const item = order.items[0]!;
  const percent = resolveCommissionPercent(Number(def.commissionPercent));
  const amount = commissionAmount(Number(item.unitPrice) * item.qty, percent);

  const ledger = await prisma.commissionLedger.create({
    data: {
      sellerId: def.id,
      orderId: order.id,
      orderItemId: item.id,
      amount,
      percent,
      status: 'pending',
    },
  });

  // Idempotent: second insert must fail unique
  let dup = false;
  try {
    await prisma.commissionLedger.create({
      data: {
        sellerId: def.id,
        orderId: order.id,
        orderItemId: item.id,
        amount,
        percent,
        status: 'pending',
      },
    });
  } catch {
    dup = true;
  }
  assert.equal(dup, true, 'unique orderItemId');

  const pending = await prisma.commissionLedger.findMany({
    where: { orderId: order.id, status: 'pending' },
  });
  assert.equal(pending.length, 1);
  assert.equal(Number(pending[0]!.amount), amount);
  assert.equal(sellerOwnsCommission(def.id, ledger.sellerId), true);
  assert.equal(sellerOwnsCommission(other.id, ledger.sellerId), false);

  if (hasPayoutCols) {
    assert.equal(canTransitionCommission('pending', 'approved'), true);
    const approved = await prisma.commissionLedger.update({
      where: { id: ledger.id },
      data: {
        status: 'approved',
        approvedAt: new Date(),
        payoutNote: 'ok para PIX',
      },
    });
    assert.equal(approved.status, 'approved');
    assert.ok(approved.approvedAt);

    const paid = await prisma.commissionLedger.update({
      where: { id: ledger.id },
      data: {
        status: 'paid',
        paidAt: new Date(),
        payoutReference: 'E2E-PIX-TEST-123',
      },
    });
    assert.equal(paid.status, 'paid');
    assert.equal(paid.payoutReference, 'E2E-PIX-TEST-123');
    assert.ok(paid.paidAt);
    assert.equal(canTransitionCommission(paid.status, 'approved'), false);
  }

  await prisma.commissionLedger.deleteMany({ where: { orderId: order.id } });
  await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
  await prisma.order.delete({ where: { id: order.id } });
  await prisma.product.delete({ where: { id: product.id } });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.seller.delete({ where: { id: other.id } }).catch(() => undefined);

  console.log('commissions.db.spec ok');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
