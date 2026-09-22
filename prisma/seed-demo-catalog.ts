/**
 * Seed controlado do catálogo demonstrativo (100 SKUs isDemo=true).
 * Não faz parte do `prisma db seed` comercial.
 * Não altera produto com isDemo=false. Aborta se um SKU DEMO já for real.
 *
 * Uso (a partir de apps/api, com DATABASE_URL local):
 *   npm run demo-catalog:seed
 *
 * Recusa NODE_ENV=production sem DEMO_CATALOG_ALLOW_PROD=1.
 * Este comando não deve ser ligado no start do Railway.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import {
  DEMO_CATALOG,
  DEMO_CATALOG_SIZE,
  DEMO_CATEGORY_SEEDS,
  demoCatalogSkuSet,
} from '../apps/api/src/modules/catalog/demo-catalog.data';

const prisma = new PrismaClient();

function refuseProduction() {
  if (process.env.NODE_ENV === 'production' && process.env.DEMO_CATALOG_ALLOW_PROD !== '1') {
    console.error(
      'Recusado: o seed DEMO não roda com NODE_ENV=production sem DEMO_CATALOG_ALLOW_PROD=1. Nada foi gravado.',
    );
    process.exit(1);
  }
}

async function main() {
  refuseProduction();
  if (DEMO_CATALOG.length !== DEMO_CATALOG_SIZE) {
    throw new Error(`Catálogo DEMO inválido: ${DEMO_CATALOG.length} itens (esperado ${DEMO_CATALOG_SIZE}).`);
  }

  const realBefore = await prisma.product.count({ where: { isDemo: false } });
  const official = demoCatalogSkuSet();

  const collisions = await prisma.product.findMany({
    where: { sku: { in: [...official] }, isDemo: false },
    select: { sku: true },
  });
  if (collisions.length) {
    throw new Error(
      `SKU já usado por produto real: ${collisions.map((c) => c.sku).join(', ')}. Seed abortado. Nenhum produto foi alterado.`,
    );
  }

  const slugOwners = await prisma.product.findMany({
    where: { slug: { in: DEMO_CATALOG.map((p) => p.slug) }, isDemo: false },
    select: { slug: true, sku: true },
  });
  if (slugOwners.length) {
    throw new Error(
      `Slug já usado por produto real: ${slugOwners.map((p) => `${p.sku}=${p.slug}`).join(', ')}. Seed abortado.`,
    );
  }

  const seller = await prisma.seller.upsert({
    where: { slug: 'lojas-schimitz' },
    update: { status: 'active' },
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Lojas Schimitz',
      slug: 'lojas-schimitz',
      status: 'active',
    },
  });

  const catIds: Record<string, string> = {};
  for (const c of DEMO_CATEGORY_SEEDS) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { active: true },
      create: { slug: c.slug, name: c.name, sort: c.sort, active: true },
    });
    catIds[c.slug] = row.id;
  }

  for (const item of DEMO_CATALOG) {
    const product = await prisma.product.upsert({
      where: { sku: item.sku },
      update: {
        name: item.name,
        slug: item.slug,
        description: item.description,
        categoryId: catIds[item.categorySlug],
        sellerId: seller.id,
        price: new Prisma.Decimal(item.price.toFixed(2)),
        compareAtPrice: new Prisma.Decimal(item.compareAtPrice.toFixed(2)),
        badge: item.badge,
        active: true,
        isDemo: true,
        weightKg: new Prisma.Decimal(item.weightKg.toFixed(3)),
        widthCm: new Prisma.Decimal(item.widthCm.toFixed(2)),
        heightCm: new Prisma.Decimal(item.heightCm.toFixed(2)),
        lengthCm: new Prisma.Decimal(item.lengthCm.toFixed(2)),
      },
      create: {
        sku: item.sku,
        name: item.name,
        slug: item.slug,
        description: item.description,
        categoryId: catIds[item.categorySlug],
        sellerId: seller.id,
        price: new Prisma.Decimal(item.price.toFixed(2)),
        compareAtPrice: new Prisma.Decimal(item.compareAtPrice.toFixed(2)),
        badge: item.badge,
        active: true,
        isDemo: true,
        weightKg: new Prisma.Decimal(item.weightKg.toFixed(3)),
        widthCm: new Prisma.Decimal(item.widthCm.toFixed(2)),
        heightCm: new Prisma.Decimal(item.heightCm.toFixed(2)),
        lengthCm: new Prisma.Decimal(item.lengthCm.toFixed(2)),
      },
    });

    const inv = await prisma.inventory.findUnique({ where: { productId: product.id } });
    const onHand = inv?.qtyReserved ?? 0;
    await prisma.inventory.upsert({
      where: { productId: product.id },
      update: { qtyOnHand: onHand },
      create: { productId: product.id, qtyOnHand: 0, qtyReserved: 0 },
    });

    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    await prisma.productImage.create({
      data: {
        productId: product.id,
        url: item.imagePath,
        alt: item.name,
        position: 0,
      },
    });
  }

  const stray = await prisma.product.findMany({
    where: { isDemo: true, sku: { notIn: [...official] } },
    select: { id: true, sku: true, _count: { select: { orderItems: true } } },
  });
  const strayDeletable = stray.filter((p) => p._count.orderItems === 0).map((p) => p.id);
  const strayBlocked = stray.filter((p) => p._count.orderItems > 0);
  if (strayDeletable.length) {
    await prisma.cartItem.deleteMany({ where: { productId: { in: strayDeletable } } });
    await prisma.product.deleteMany({ where: { id: { in: strayDeletable }, isDemo: true } });
  }
  if (strayBlocked.length) {
    await prisma.product.updateMany({
      where: { id: { in: strayBlocked.map((p) => p.id) }, isDemo: true },
      data: { active: false },
    });
    console.warn(
      `DEMO fora da lista oficial com pedido vinculado (só desativados): ${strayBlocked.map((p) => p.sku).join(', ')}`,
    );
  }

  const demo = await prisma.product.count({ where: { isDemo: true } });
  const realAfter = await prisma.product.count({ where: { isDemo: false } });
  if (realAfter !== realBefore) {
    throw new Error(`Contagem de produtos reais mudou (${realBefore} → ${realAfter}). Investigar antes de usar.`);
  }
  if (demo !== DEMO_CATALOG_SIZE) {
    throw new Error(`Esperado ${DEMO_CATALOG_SIZE} isDemo=true, encontrado ${demo}.`);
  }

  const byCategory = await prisma.product.groupBy({
    by: ['categoryId'],
    where: { isDemo: true },
    _count: { _all: true },
  });
  console.log(
    JSON.stringify(
      {
        demo,
        realUnchanged: realAfter,
        categories: byCategory.length,
        note: 'qtyOnHand permanece 0 (ou igual à reserva, se houver). Compra continua bloqueada no backend.',
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
