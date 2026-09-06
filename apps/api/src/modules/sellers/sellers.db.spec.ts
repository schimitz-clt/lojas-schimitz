/**
 * Marketplace v1 — default seller backfill, product.seller, admin status.
 * Requer DATABASE_URL + migration SCH-008.
 */
import assert from 'assert';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  DEFAULT_SELLER_ID,
  DEFAULT_SELLER_SLUG,
  publicSellerShape,
} from './sellers.constants';

const prisma = new PrismaClient();

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('sellers.db.spec SKIP (sem DATABASE_URL)');
    return;
  }

  const def = await prisma.seller.upsert({
    where: { slug: DEFAULT_SELLER_SLUG },
    update: { name: 'Lojas Schimitz', status: 'active' },
    create: {
      id: DEFAULT_SELLER_ID,
      name: 'Lojas Schimitz',
      slug: DEFAULT_SELLER_SLUG,
      status: 'active',
    },
  });
  assert.equal(def.slug, DEFAULT_SELLER_SLUG);
  assert.equal(def.status, 'active');

  // Backfill: any product without seller should be impossible after NOT NULL,
  // but ensure all products point to a real seller.
  const orphans = await prisma.$queryRaw<{ c: bigint }[]>`
    SELECT COUNT(*)::bigint AS c FROM "Product" p
    LEFT JOIN "Seller" s ON s."id" = p."sellerId"
    WHERE s."id" IS NULL
  `;
  assert.equal(Number(orphans[0]?.c ?? 0), 0, 'products must have valid sellerId');

  // Product includes seller shape
  const sku = `TMP-SEL-${randomUUID().slice(0, 8)}`;
  const product = await prisma.product.create({
    data: {
      sku,
      name: 'Temp seller product',
      slug: sku.toLowerCase(),
      description: 'temp',
      price: 10,
      active: false,
      sellerId: def.id,
    },
    include: { seller: { select: { id: true, name: true, slug: true } } },
  });
  try {
    assert.ok(product.seller);
    assert.deepEqual(publicSellerShape(product.seller), {
      id: def.id,
      name: def.name,
      slug: def.slug,
    });

    // Admin seller status transitions
    const partner = await prisma.seller.create({
      data: {
        name: `Parceiro ${sku.slice(-4)}`,
        slug: `parceiro-${sku.toLowerCase()}`,
        status: 'pending',
      },
    });
    try {
      const active = await prisma.seller.update({
        where: { id: partner.id },
        data: { status: 'active' },
      });
      assert.equal(active.status, 'active');
      const suspended = await prisma.seller.update({
        where: { id: partner.id },
        data: { status: 'suspended' },
      });
      assert.equal(suspended.status, 'suspended');
    } finally {
      await prisma.seller.delete({ where: { id: partner.id } }).catch(() => undefined);
    }
  } finally {
    await prisma.product.delete({ where: { id: product.id } }).catch(() => undefined);
  }

  console.log('sellers.db.spec ok');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
