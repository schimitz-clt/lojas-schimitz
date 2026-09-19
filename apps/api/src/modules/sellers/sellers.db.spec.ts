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
  publicSellerListItem,
  publicSellerShape,
} from './sellers.constants';
import { buildProductWhere } from '../catalog/catalog.query';

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

      const hiddenSku = `TMP-HID-${randomUUID().slice(0, 8)}`;
      const hidden = await prisma.product.create({
        data: {
          sku: hiddenSku,
          name: 'Temp hidden seller product',
          slug: hiddenSku.toLowerCase(),
          description: 'temp',
          price: 11,
          active: true,
          sellerId: partner.id,
        },
      });
      try {
        const listed = await prisma.product.findMany({
          where: buildProductWhere({}),
          select: { id: true },
        });
        assert.equal(
          listed.some((p) => p.id === hidden.id),
          false,
          'suspended seller products must not appear in public catalog',
        );
        const publicRows = await prisma.seller.findMany({
          where: { status: 'active' },
          select: { id: true, name: true, slug: true, status: true },
        });
        assert.ok(publicRows.every((s) => s.status === 'active'));
        assert.equal(
          publicRows.some((s) => s.id === partner.id),
          false,
          'suspended seller must not be in public directory',
        );
        const card = publicSellerListItem({
          id: def.id,
          name: def.name,
          slug: def.slug,
          productCount: 1,
        });
        assert.ok(!('status' in card));
      } finally {
        await prisma.product.delete({ where: { id: hidden.id } }).catch(() => undefined);
      }
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
