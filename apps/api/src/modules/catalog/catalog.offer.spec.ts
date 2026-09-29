import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  isRealOfferDeal,
  offerDealIdWhere,
  offerDealIds,
} from './catalog.query';

assert.equal(isRealOfferDeal(100, 150), true, 'A');
assert.equal(isRealOfferDeal(100, 100), false, 'B');
assert.equal(isRealOfferDeal(100, 90), false, 'C');
assert.equal(isRealOfferDeal(100, null), false, 'D');
assert.equal(isRealOfferDeal(0, 100), false, 'E');
assert.equal(isRealOfferDeal(100, undefined), false, 'F-no-compare');

async function main() {
  const prisma = {
    $queryRaw: async () => [{ id: 'deal-1' }, { id: 'deal-2' }],
  };
  const ids = await offerDealIds(prisma);
  assert.deepEqual(ids, ['deal-1', 'deal-2']);
  assert.deepEqual(offerDealIdWhere(ids), { id: { in: ['deal-1', 'deal-2'] } });
  assert.deepEqual(offerDealIdWhere([]), { id: { in: [] } });

  const src = readFileSync(join(__dirname, 'catalog.controller.ts'), 'utf8');
  assert.ok(src.includes('offerDealIds'), 'list uses SQL deal ids');
  assert.ok(src.includes('offerDealIdWhere'), 'count/page share the same id set');
  console.log('catalog.offer: A–F + id filter — PASSOU');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
