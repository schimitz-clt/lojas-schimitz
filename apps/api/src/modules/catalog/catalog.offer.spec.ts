import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildProductWhere, isRealOfferDeal, offersCatalogWhere, type ProductPriceFieldRef } from './catalog.query';

assert.equal(isRealOfferDeal(100, 150), true, 'A');
assert.equal(isRealOfferDeal(100, 100), false, 'B');
assert.equal(isRealOfferDeal(100, 90), false, 'C');
assert.equal(isRealOfferDeal(100, null), false, 'D');
assert.equal(isRealOfferDeal(0, 100), false, 'E');
assert.equal(isRealOfferDeal(100, undefined), false, 'F-no-compare');

// G: with the price field reference the column-to-column filter lives in the same WHERE.
const ref = { modelName: 'Product', name: 'price', typeName: 'Decimal', isList: false } as unknown as ProductPriceFieldRef;
assert.deepEqual(offersCatalogWhere(ref), {
  AND: [{ compareAtPrice: { not: null } }, { price: { gt: 0 } }, { compareAtPrice: { gt: ref } }],
});
// H: without it, only the portable pre-filter (pure callers).
assert.deepEqual(offersCatalogWhere(), { AND: [{ compareAtPrice: { not: null } }, { price: { gt: 0 } }] });
// I: buildProductWhere forwards the ref only for the offers department.
assert.deepEqual(buildProductWhere({ category: 'ofertas' }, { priceRef: ref }).AND?.[2], { compareAtPrice: { gt: ref } });
assert.equal(buildProductWhere({ category: 'eletro' }, { priceRef: ref }).AND, undefined);

// J: the controller passes the real field reference and no longer pre-fetches every deal id.
const src = readFileSync(join(__dirname, 'catalog.controller.ts'), 'utf8');
assert.ok(src.includes('priceRef: this.prisma.product.fields.price'), 'list/count usam field reference');
assert.ok(!src.includes('offerDealIds'), 'sem SELECT extra de ids de oferta');
assert.ok(!/id:\s*\{\s*in:/.test(src), 'sem IN list de ids');

console.log('catalog.offer: A–J (field reference, sem IN list) — PASSOU');
