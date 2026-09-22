/**
 * Catálogo demonstrativo: 100 SKUs, guards de compra e separação do CSV real.
 * Não abre banco. Evidência de listagem/PDP/paginação ao vivo: NÃO EXECUTADO sem DATABASE_URL.
 */
import assert from 'assert';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { toProductHit } from '../chat/ai.tools';
import { renderDemoCatalogSvg } from './demo-catalog-art';
import {
  DEMO_CATALOG,
  DEMO_CATALOG_SIZE,
  DEMO_CATEGORY_SLUGS,
  demoCatalogImagePath,
} from './demo-catalog.data';
import { demoPurchaseRejection, sellableProductWhere } from './demo-product';

const root = join(__dirname, '../../../../..');

{
  assert.equal(DEMO_CATALOG.length, DEMO_CATALOG_SIZE);
  const skus = DEMO_CATALOG.map((p) => p.sku);
  assert.equal(new Set(skus).size, 100);
  for (let i = 1; i <= 100; i++) {
    assert.equal(skus[i - 1], `DEMO-${String(i).padStart(4, '0')}`);
  }
  const slugs = new Set(DEMO_CATALOG.map((p) => p.slug));
  assert.equal(slugs.size, 100);
  for (const slug of slugs) {
    assert.ok(slug.startsWith('demo-'));
    assert.ok(slug.length <= 80);
  }
  for (const cat of DEMO_CATEGORY_SLUGS) {
    assert.equal(DEMO_CATALOG.filter((p) => p.categorySlug === cat).length, 10, cat);
  }
  const banned =
    /\b(samsung|apple|iphone|xiaomi|motorola|philips|electrolux|brastemp|consul|nike|adidas|magalu|sony|jbl|dell|lenovo|asus|sansung|aiwa|logitech|lg|hp)\b/i;
  for (const item of DEMO_CATALOG) {
    assert.ok(/— (Série Demo|Linha Demo)$/.test(item.name), item.name);
    assert.equal(item.badge, 'Demonstrativo');
    assert.ok(item.description.includes('demonstrativo'));
    assert.ok(item.description.includes('Schimitz Demo'));
    assert.ok(item.price > 0 && item.compareAtPrice > item.price);
    assert.ok(item.weightKg > 0);
    assert.equal(item.imagePath, demoCatalogImagePath(item.sku));
    assert.ok(!/placehold\.co|https?:\/\//i.test(item.imagePath));
    const blob = `${item.name} ${item.description}`;
    assert.equal(banned.test(blob), false, blob);
    const svg = renderDemoCatalogSvg({
      title: item.name,
      sku: item.sku,
      art: item.art,
      bg: item.bg,
      accent: item.accent,
    });
    assert.ok(svg.includes(item.sku));
    assert.ok(!/<script|placehold\.co/i.test(svg));
    assert.ok(!/https?:\/\/(?!www\.w3\.org)/.test(svg));
    const file = join(root, 'apps/web/public/demo-catalog', `${item.sku}.svg`);
    assert.ok(existsSync(file), `imagem ausente ${item.imagePath}`);
    const stored = readFileSync(file, 'utf8');
    assert.ok(stored.includes('<svg'));
    assert.ok(!/placehold\.co/i.test(stored));
  }
  const pageSize = 24;
  const page5 = DEMO_CATALOG.slice(4 * pageSize, 5 * pageSize);
  assert.equal(page5.length, 4);
  assert.equal(page5[0].sku, 'DEMO-0097');
  console.log('demo-catalog: 100 SKUs + imagens — PASSOU');
}

{
  assert.equal(demoPurchaseRejection({ isDemo: false, name: 'Real' }), null);
  assert.equal(demoPurchaseRejection(null), null);
  const blocked = demoPurchaseRejection({ isDemo: true, name: 'Smart TV 50" 4K UHD — Série Demo' });
  assert.ok(blocked);
  assert.equal(blocked?.code, 'DEMO_NOT_PURCHASABLE');
  assert.ok(blocked?.message.includes('demonstrativo'));
  assert.ok(blocked?.message.includes('Série Demo'));
  const where = sellableProductWhere({ active: true, seller: { status: 'active' } });
  assert.equal(where.active, true);
  assert.equal(where.isDemo, false);
  console.log('demo-catalog: guard puro — PASSOU');
}

{
  const hit = toProductHit({
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Fone Bluetooth ANC — Linha Demo',
    slug: 'demo-fone',
    price: 349.9,
    badge: 'Demonstrativo',
    isDemo: true,
    inventory: { qtyOnHand: 50, qtyReserved: 0 },
  });
  assert.equal(hit.isDemo, true);
  assert.equal(hit.inStock, false);
  const real = toProductHit({
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Notebook i5',
    slug: 'notebook',
    price: 10,
    inventory: { qtyOnHand: 2, qtyReserved: 0 },
  });
  assert.equal(real.inStock, true);
  assert.equal(real.isDemo, false);
  console.log('demo-catalog: chat não marca DEMO como comprável — PASSOU');
}

{
  const read = (rel: string) => readFileSync(join(root, rel), 'utf8');
  const cart = read('apps/api/src/modules/cart/cart.service.ts');
  const orders = read('apps/api/src/modules/orders/orders.service.ts');
  const payments = read('apps/api/src/modules/payments/payments.service.ts');
  const inventory = read('apps/api/src/modules/inventory/inventory.service.ts');
  const csv = read('apps/api/src/modules/admin/catalog-csv.ts');
  const cleanup = read('prisma/demo-catalog-cleanup.ts');
  const seed = read('prisma/seed-demo-catalog.ts');
  assert.ok(cart.includes('demoPurchaseRejection'));
  assert.ok(cart.includes('product.isDemo) continue'));
  assert.ok(orders.includes('demoPurchaseRejection'));
  assert.ok(orders.indexOf('demoPurchaseRejection') < orders.indexOf('this.inventory.reserve'));
  assert.ok(payments.includes('rejectDemoOrder'));
  assert.ok(payments.indexOf('await this.rejectDemoOrder') < payments.indexOf('idempotencyRecord.findUnique'));
  assert.ok(inventory.includes('demoPurchaseRejection'));
  assert.ok(inventory.includes('await this.rejectDemo(tx, productId)'));
  assert.equal(csv.includes("isDemo: 'isDemo'"), false);
  assert.equal(csv.includes('isdemo:'), false);
  assert.ok(cleanup.includes('isDemo: true'));
  assert.ok(cleanup.includes('isDemo: false'));
  assert.ok(seed.includes('isDemo: true'));
  assert.ok(seed.includes('isDemo: false'));
  assert.ok(!seed.includes('placehold.co'));
  console.log('demo-catalog: contratos de guard e limpeza — PASSOU');
}

console.log('demo-catalog.spec ok');
