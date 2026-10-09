/**
 * DB: GET /products?category=ofertas through the real CatalogController against Postgres.
 * Offer = active, price > 0 and compareAtPrice strictly above price. total/sellableTotal and pages
 * must agree with the rows. Skips when DATABASE_URL is unset. Cleans up its own rows.
 */
import assert from 'assert';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { CatalogController } from './catalog.controller';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('catalog.offers.db.spec SKIP (sem DATABASE_URL)');
    return;
  }
  const prisma = new PrismaClient();
  const tag = `ofr-${randomUUID().slice(0, 8)}`;
  const sellerId = randomUUID();
  const categoryId = randomUUID();
  try {
    await prisma.seller.create({
      data: { id: sellerId, name: `Seller ${tag}`, slug: `seller-${tag}`, status: 'active' } as never,
    });
    await prisma.category.create({ data: { id: categoryId, name: `Cat ${tag}`, slug: `cat-${tag}` } as never });
    const rows: { key: string; price: string; compareAt: string | null; active?: boolean; isDemo?: boolean }[] = [
      { key: 'deal', price: '100.00', compareAt: '150.00' },
      { key: 'deal-cents', price: '99.99', compareAt: '100.00' },
      { key: 'deal-demo', price: '50.00', compareAt: '80.00', isDemo: true },
      { key: 'equal', price: '100.00', compareAt: '100.00' },
      { key: 'inverted', price: '100.00', compareAt: '90.00' },
      { key: 'no-compare', price: '100.00', compareAt: null },
      { key: 'zero-price', price: '0.00', compareAt: '10.00' },
      { key: 'inactive-deal', price: '10.00', compareAt: '20.00', active: false },
    ];
    for (const r of rows) {
      await prisma.product.create({
        data: {
          name: `Produto ${tag} ${r.key}`,
          slug: `${tag}-${r.key}`,
          sku: `${tag}-${r.key}`,
          description: 'teste',
          price: r.price,
          compareAtPrice: r.compareAt,
          active: r.active ?? true,
          isDemo: r.isDemo ?? false,
          sellerId,
          categoryId,
        } as never,
      });
    }

    const ctrl = new CatalogController(prisma as never);
    const res = (await ctrl.products(tag, 'ofertas', undefined, undefined, 'price_asc', undefined, '1', '60')) as {
      data: { items: { slug: string }[]; total: number; sellableTotal: number; demoTotal: number };
    };
    const slugs = res.data.items.map((i) => i.slug).sort();
    assert.deepEqual(slugs, [`${tag}-deal`, `${tag}-deal-cents`, `${tag}-deal-demo`].sort(), JSON.stringify(slugs));
    assert.equal(res.data.total, 3);
    assert.equal(res.data.sellableTotal, 2);
    assert.equal(res.data.demoTotal, 1);

    // sellable=1 drops the demo deal; pagination counts match the same WHERE.
    const sellable = (await ctrl.products(tag, 'ofertas', undefined, undefined, 'price_asc', undefined, '1', '60', '1')) as {
      data: { items: { slug: string }[]; total: number };
    };
    assert.deepEqual(sellable.data.items.map((i) => i.slug).sort(), [`${tag}-deal`, `${tag}-deal-cents`].sort());
    assert.equal(sellable.data.total, 2);
    const p1 = (await ctrl.products(tag, 'ofertas', undefined, undefined, 'price_asc', undefined, '1', '2')) as {
      data: { items: { slug: string }[]; total: number };
    };
    const p2 = (await ctrl.products(tag, 'ofertas', undefined, undefined, 'price_asc', undefined, '2', '2')) as {
      data: { items: { slug: string }[]; total: number };
    };
    assert.equal(p1.data.total, 3);
    assert.equal(p1.data.items.length + p2.data.items.length, 3);

    // Price filter combines with the column comparison.
    const cheap = (await ctrl.products(tag, 'ofertas', '60', '100', 'price_asc', undefined, '1', '60')) as {
      data: { items: { slug: string }[] };
    };
    assert.deepEqual(cheap.data.items.map((i) => i.slug).sort(), [`${tag}-deal`, `${tag}-deal-cents`].sort());

    console.log('catalog.offers.db.spec OK (8 linhas: 3 ofertas reais, 5 excluídas; contagens e páginas coerentes)');
  } finally {
    await prisma.product.deleteMany({ where: { sellerId } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.seller.deleteMany({ where: { id: sellerId } });
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
