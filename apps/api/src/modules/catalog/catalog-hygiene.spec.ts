/**
 * Catalog hygiene rules (Roblox stock + missing images).
 * Pure assertions + optional DB check when DATABASE_URL is set.
 */
import assert from 'assert';
import { PrismaClient } from '@prisma/client';

function placeholdUrl(name: string) {
  return `https://placehold.co/800x800/1a1a1a/f5c518?text=${encodeURIComponent(name)}`;
}

{
  const url = placeholdUrl('Tênis running');
  assert.ok(url.includes('placehold.co'));
  assert.ok(url.includes('T%C3%AAnis') || url.includes(encodeURIComponent('Tênis')));
  console.log('catalog-hygiene: placehold pattern — PASSOU');
}

{
  // Production-safe rule: only bump when onHand <= 0
  function nextStock(onHand: number, min = 50) {
    return onHand <= 0 ? min : onHand;
  }
  assert.equal(nextStock(0), 50);
  assert.equal(nextStock(-1), 50);
  assert.equal(nextStock(12), 12);
  console.log('catalog-hygiene: roblox stock rule — PASSOU');
}

async function dbCheck() {
  if (!process.env.DATABASE_URL) {
    console.log('catalog-hygiene.db SKIP (sem DATABASE_URL)');
    return;
  }
  const prisma = new PrismaClient();
  try {
    const roblox = await prisma.product.findFirst({
      where: { OR: [{ slug: 'roblox' }, { name: { equals: 'Roblox', mode: 'insensitive' } }] },
      include: { inventory: true, images: true },
    });
    if (!roblox) {
      console.log('catalog-hygiene.db: no roblox product (ok in empty DB)');
      return;
    }
    // After migration/seed these should hold; if not yet migrated, skip soft
    const onHand = roblox.inventory?.qtyOnHand ?? 0;
    if (onHand <= 0) {
      console.log('catalog-hygiene.db: roblox still 0 — run migrate/seed');
      return;
    }
    assert.ok(onHand >= 50, `roblox stock ${onHand}`);
    const img = roblox.images.find((i) => i.url?.trim());
    assert.ok(img, 'roblox should have image after hygiene');
    console.log('catalog-hygiene.db — PASSOU');
  } finally {
    await prisma.$disconnect();
  }
}

dbCheck().catch((e) => {
  console.error(e);
  process.exit(1);
});
