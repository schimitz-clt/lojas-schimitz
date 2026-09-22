/**
 * Limpeza só de produtos isDemo=true. Nunca altera isDemo=false.
 * Idempotente.
 *
 *   npm run demo-catalog:deactivate   — active=false em todos isDemo
 *   npm run demo-catalog:delete       — apaga isDemo sem pedido; os que têm pedido só desativam
 *
 * Recusa NODE_ENV=production sem DEMO_CATALOG_ALLOW_PROD=1.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function refuseProduction() {
  if (process.env.NODE_ENV === 'production' && process.env.DEMO_CATALOG_ALLOW_PROD !== '1') {
    console.error(
      'Recusado: limpeza DEMO não roda com NODE_ENV=production sem DEMO_CATALOG_ALLOW_PROD=1. Nada foi gravado.',
    );
    process.exit(1);
  }
}

async function main() {
  refuseProduction();
  const mode = process.argv.includes('--delete')
    ? 'delete'
    : process.argv.includes('--deactivate')
      ? 'deactivate'
      : null;
  if (!mode) {
    console.error('Informe --deactivate ou --delete. Nada foi gravado.');
    process.exit(1);
  }

  const realBefore = await prisma.product.count({ where: { isDemo: false } });
  const demoBefore = await prisma.product.count({ where: { isDemo: true } });

  if (mode === 'deactivate') {
    const result = await prisma.product.updateMany({
      where: { isDemo: true },
      data: { active: false },
    });
    const realAfter = await prisma.product.count({ where: { isDemo: false } });
    if (realAfter !== realBefore) {
      throw new Error('A desativação alterou a contagem de produtos reais. Abortar investigação.');
    }
    console.log(
      JSON.stringify(
        { mode, deactivated: result.count, demoStillPresent: demoBefore, realUnchanged: realAfter },
        null,
        2,
      ),
    );
    return;
  }

  const demos = await prisma.product.findMany({
    where: { isDemo: true },
    select: { id: true, sku: true, _count: { select: { orderItems: true } } },
  });
  const blocked = demos.filter((p) => p._count.orderItems > 0);
  const deletable = demos.filter((p) => p._count.orderItems === 0).map((p) => p.id);

  if (deletable.length) {
    await prisma.cartItem.deleteMany({ where: { productId: { in: deletable }, product: { isDemo: true } } });
    await prisma.product.deleteMany({ where: { id: { in: deletable }, isDemo: true } });
  }
  if (blocked.length) {
    await prisma.product.updateMany({
      where: { id: { in: blocked.map((p) => p.id) }, isDemo: true },
      data: { active: false },
    });
  }

  const realAfter = await prisma.product.count({ where: { isDemo: false } });
  const demoAfter = await prisma.product.count({ where: { isDemo: true } });
  if (realAfter !== realBefore) {
    throw new Error('A limpeza alterou a contagem de produtos reais.');
  }
  console.log(
    JSON.stringify(
      {
        mode,
        deleted: deletable.length,
        deactivatedBecauseOrder: blocked.map((p) => p.sku),
        demoRemaining: demoAfter,
        realUnchanged: realAfter,
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
