/**
 * Integração Postgres — CAS de reserva/commit/release (sem Nest).
 * Requer DATABASE_URL. Cria produto temporário e limpa ao final.
 */
import assert from 'assert';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function reserve(productId: string, qty: number) {
  return prisma.$executeRaw`
    UPDATE "Inventory"
    SET "qtyReserved" = "qtyReserved" + ${qty}
    WHERE "productId" = ${productId}
      AND ("qtyOnHand" - "qtyReserved") >= ${qty}
  `;
}

async function release(productId: string, qty: number) {
  return prisma.$executeRaw`
    UPDATE "Inventory"
    SET "qtyReserved" = "qtyReserved" - ${qty}
    WHERE "productId" = ${productId}
      AND "qtyReserved" >= ${qty}
  `;
}

async function commitSale(productId: string, qty: number) {
  return prisma.$executeRaw`
    UPDATE "Inventory"
    SET "qtyOnHand" = "qtyOnHand" - ${qty},
        "qtyReserved" = "qtyReserved" - ${qty}
    WHERE "productId" = ${productId}
      AND "qtyReserved" >= ${qty}
      AND "qtyOnHand" >= ${qty}
  `;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('inventory.db.spec SKIP (sem DATABASE_URL)');
    return;
  }

  const sku = `TMP-INV-${randomUUID().slice(0, 8)}`;
  const slug = sku.toLowerCase();
  const product = await prisma.product.create({
    data: {
      sku,
      name: 'Temp inventory test',
      slug,
      description: 'temp',
      price: 1,
      active: false,
      inventory: { create: { qtyOnHand: 1, qtyReserved: 0 } },
    },
  });

  try {
    const r1 = await reserve(product.id, 1);
    const r2 = await reserve(product.id, 1);
    assert.equal(r1, 1);
    assert.equal(r2, 0);
    let inv = await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } });
    assert.equal(inv.qtyReserved, 1);
    assert.equal(inv.qtyOnHand, 1);

    const pay = await commitSale(product.id, 1);
    assert.equal(pay, 1);
    inv = await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } });
    assert.equal(inv.qtyOnHand, 0);
    assert.equal(inv.qtyReserved, 0);

    // Reposição + cancel path
    await prisma.inventory.update({
      where: { productId: product.id },
      data: { qtyOnHand: 2, qtyReserved: 0 },
    });
    assert.equal(await reserve(product.id, 2), 1);
    assert.equal(await release(product.id, 2), 1);
    inv = await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } });
    assert.equal(inv.qtyOnHand, 2);
    assert.equal(inv.qtyReserved, 0);

    console.log('inventory.db postgres tests ok');
  } finally {
    await prisma.inventory.deleteMany({ where: { productId: product.id } });
    await prisma.product.delete({ where: { id: product.id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
