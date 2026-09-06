/**
 * DB check: public product list ORDER BY price is numeric (Prisma Decimal).
 * Skips when DATABASE_URL is unset.
 */
import assert from 'assert';
import { PrismaClient } from '@prisma/client';
import { buildProductOrderBy, buildProductWhere, toNumericPrice } from './catalog.query';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('catalog.list.db.spec SKIP (sem DATABASE_URL)');
    return;
  }

  const prisma = new PrismaClient();
  try {
    const where = buildProductWhere({});
    const asc = await prisma.product.findMany({
      where,
      orderBy: buildProductOrderBy('price_asc'),
      take: 60,
      select: { id: true, name: true, price: true, slug: true },
    });
    const desc = await prisma.product.findMany({
      where,
      orderBy: buildProductOrderBy('price_desc'),
      take: 60,
      select: { id: true, name: true, price: true, slug: true },
    });

    if (asc.length < 2) {
      console.log('catalog.list.db.spec: fewer than 2 products — skip order asserts');
      return;
    }

    for (let i = 1; i < asc.length; i++) {
      const prev = toNumericPrice(asc[i - 1].price);
      const cur = toNumericPrice(asc[i].price);
      assert.ok(prev <= cur, `price_asc broken at ${i}: ${prev} > ${cur}`);
    }
    for (let i = 1; i < desc.length; i++) {
      const prev = toNumericPrice(desc[i - 1].price);
      const cur = toNumericPrice(desc[i].price);
      assert.ok(prev >= cur, `price_desc broken at ${i}: ${prev} < ${cur}`);
    }

    assert.equal(asc[0].id, desc[desc.length - 1].id, 'asc first should equal desc last');
    assert.equal(desc[0].id, asc[asc.length - 1].id, 'desc first should equal asc last');

    const roblox = asc.find((p) => p.slug === 'roblox' || p.name.toLowerCase() === 'roblox');
    if (roblox && toNumericPrice(roblox.price) === 2) {
      assert.equal(asc[0].id, roblox.id, 'Roblox R$2 must be first on price_asc');
    }

    // Filters: minPrice / maxPrice / category
    const mid = await prisma.product.findMany({
      where: buildProductWhere({ minPrice: '200', maxPrice: '1500' }),
      orderBy: buildProductOrderBy('price_asc'),
      select: { price: true, category: { select: { slug: true } } },
    });
    for (const p of mid) {
      const n = toNumericPrice(p.price);
      assert.ok(n >= 200 && n <= 1500, `min/max filter leaked price ${n}`);
    }

    console.log('catalog.list.db.spec — PASSOU');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
