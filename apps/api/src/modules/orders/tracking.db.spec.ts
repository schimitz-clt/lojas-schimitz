/**
 * Logistics — trackingCode/carrier set on in_transit; visible on order read.
 * Requer DATABASE_URL.
 */
import assert from 'assert';
import { PrismaClient, OrderStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { DEFAULT_SELLER_ID, DEFAULT_SELLER_SLUG } from '../sellers/sellers.constants';

const prisma = new PrismaClient();

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('tracking.db.spec SKIP (sem DATABASE_URL)');
    return;
  }

  const seller = await prisma.seller.upsert({
    where: { slug: DEFAULT_SELLER_SLUG },
    update: {},
    create: {
      id: DEFAULT_SELLER_ID,
      name: 'Lojas Schimitz',
      slug: DEFAULT_SELLER_SLUG,
      status: 'active',
    },
  });

  const sku = `TMP-TRK-${randomUUID().slice(0, 8)}`;
  const product = await prisma.product.create({
    data: {
      sku,
      name: 'Temp tracking product',
      slug: sku.toLowerCase(),
      description: 'temp',
      price: 1,
      active: false,
      sellerId: seller.id,
    },
  });

  const publicId = `SCH-TEST-${randomUUID().slice(0, 8).toUpperCase()}`;
  const order = await prisma.order.create({
    data: {
      publicId,
      status: 'ready_for_pickup',
      subtotal: 1,
      total: 1,
      items: {
        create: {
          productId: product.id,
          name: product.name,
          qty: 1,
          unitPrice: 1,
          sellerId: seller.id,
        },
      },
    },
  });

  try {
    const code = `BR${randomUUID().slice(0, 10).toUpperCase()}`;
    const updated = await prisma.order.updateMany({
      where: { id: order.id, status: 'ready_for_pickup' },
      data: {
        status: 'in_transit' as OrderStatus,
        trackingCode: code,
        carrier: 'propria',
      },
    });
    assert.equal(updated.count, 1);

    const got = await prisma.order.findFirst({
      where: { publicId },
      include: { items: true },
    });
    assert.ok(got);
    assert.equal(got!.status, 'in_transit');
    assert.equal(got!.trackingCode, code);
    assert.equal(got!.carrier, 'propria');
    assert.equal(got!.items[0]?.sellerId, seller.id);
  } finally {
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } }).catch(() => undefined);
    await prisma.product.delete({ where: { id: product.id } }).catch(() => undefined);
  }

  console.log('tracking.db.spec ok');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
