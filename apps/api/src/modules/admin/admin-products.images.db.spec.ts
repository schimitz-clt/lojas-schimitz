/**
 * Regression: PATCH product with empty imageUrl must NOT delete ProductImage rows.
 * 2026-09-18 production: Admin save wiped Sansung A54 gallery (images: []).
 *
 * Real Postgres + AdminProductsService. Skips when DATABASE_URL is unset.
 * Never railway.internal / produção.
 */
import assert from 'assert';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { SellersService } from '../sellers/sellers.service';
import { AdminProductsService } from './admin-products.service';

function assertNotProductionDb(url: string) {
  if (/railway|rlwy|\.internal/i.test(url)) {
    throw new Error('RECUSADO: DATABASE_URL parece produção/Railway');
  }
}

async function main() {
  const url = process.env.DATABASE_URL || '';
  if (!url) {
    console.log('admin-products.images.db.spec SKIP (sem DATABASE_URL)');
    return;
  }
  assertNotProductionDb(url);

  const prisma = new PrismaService();
  const products = new AdminProductsService(
    prisma,
    new SellersService(prisma),
    new InventoryService(),
  );

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

  const sku = `TMP-IMG-${randomUUID().slice(0, 8)}`;
  const product = await prisma.product.create({
    data: {
      sku,
      name: 'Temp gallery wipe test',
      slug: sku.toLowerCase(),
      description: 'before save',
      price: 10,
      active: false,
      sellerId: seller.id,
      inventory: { create: { qtyOnHand: 1, qtyReserved: 0 } },
      images: {
        create: [
          {
            url: 'https://cdn.example/cover-keep.jpg',
            alt: 'capa',
            position: 0,
          },
          {
            url: 'https://cdn.example/extra-keep.jpg',
            alt: 'extra',
            position: 1,
          },
        ],
      },
    },
    include: { images: { orderBy: { position: 'asc' } } },
  });

  const originalIds = product.images.map((img) => img.id).sort();
  const originalUrls = product.images.map((img) => img.url).sort();
  assert.equal(originalIds.length, 2, 'fixture has cover + extra');

  try {
    await products.update(product.id, {
      name: 'Temp gallery wipe test (saved)',
      description: 'after save without photos',
      imageUrl: '',
    });

    await products.update(product.id, { imageUrl: '   ' });
    await products.update(product.id, { imageUrl: null });

    const afterEmpty = await prisma.productImage.findMany({
      where: { productId: product.id },
      orderBy: { position: 'asc' },
    });
    assert.equal(
      afterEmpty.length,
      2,
      'empty imageUrl on update must not delete ProductImage rows',
    );
    assert.deepEqual(
      afterEmpty.map((img) => img.id).sort(),
      originalIds,
      'same ProductImage ids after empty imageUrl updates',
    );
    assert.deepEqual(
      afterEmpty.map((img) => img.url).sort(),
      originalUrls,
      'same ProductImage urls after empty imageUrl updates',
    );

    const coverId = product.images[0].id;
    const extraId = product.images[1].id;
    await products.update(product.id, {
      imageUrl: 'https://cdn.example/new-cover.jpg',
    });
    const afterCover = await prisma.productImage.findMany({
      where: { productId: product.id },
      orderBy: { position: 'asc' },
    });
    assert.equal(afterCover.length, 2, 'setting a real cover must not drop extras');
    assert.equal(afterCover[0].id, coverId, 'cover row updated in place, not deleted');
    assert.equal(afterCover[0].url, 'https://cdn.example/new-cover.jpg');
    assert.equal(afterCover[1].id, extraId);
    assert.equal(afterCover[1].url, 'https://cdn.example/extra-keep.jpg');

    const named = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    assert.equal(named.name, 'Temp gallery wipe test (saved)');
    assert.equal(named.description, 'after save without photos');

    console.log('admin-products.images.db.spec — PASSOU');
  } finally {
    await prisma.product.delete({ where: { id: product.id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
