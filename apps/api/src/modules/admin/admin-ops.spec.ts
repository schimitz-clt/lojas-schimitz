import assert from 'assert';
import {
  DEFAULT_OPS_LOW_STOCK_THRESHOLD,
  countPlaceholderProducts,
  isLowOnHand,
  isMissingOrPlaceholderImage,
  isPlaceholderImageUrl,
  summarizeInventoryOps,
  summarizeOps,
} from './admin-ops';

assert.equal(DEFAULT_OPS_LOW_STOCK_THRESHOLD, 5);
assert.equal(isLowOnHand(0), true);
assert.equal(isLowOnHand(5), true);
assert.equal(isLowOnHand(6), false);
assert.equal(isLowOnHand(null), false);
assert.equal(isLowOnHand(undefined), false);
assert.equal(isLowOnHand(3, 2), false);
assert.equal(isLowOnHand(2, 2), true);

const snap = summarizeInventoryOps({
  lowStockCount: 4,
  outOfStockCount: 1,
  time: '2026-09-12T00:00:00.000Z',
});
assert.equal(snap.inventory.lowStockThreshold, 5);
assert.equal(snap.inventory.lowStockCount, 4);
assert.equal(snap.inventory.outOfStockCount, 1);
assert.equal(snap.time, '2026-09-12T00:00:00.000Z');

assert.equal(isPlaceholderImageUrl('https://placehold.co/600x400'), true);
assert.equal(isPlaceholderImageUrl('https://via.placeholder.com/800'), true);
assert.equal(isPlaceholderImageUrl('https://cdn.lojasschimitz.com.br/x.png'), false);
assert.equal(isMissingOrPlaceholderImage(''), true);
assert.equal(isMissingOrPlaceholderImage(null), true);
assert.equal(isMissingOrPlaceholderImage('https://lojasschimitz.com.br/api/v1/uploads/a.png'), false);

assert.equal(
  countPlaceholderProducts([
    { images: [] },
    { images: [{ url: 'https://placehold.co/1' }] },
    { images: [{ url: 'https://lojasschimitz.com.br/api/v1/uploads/ok.png' }] },
    { images: null },
  ]),
  3,
);

const full = summarizeOps({
  lowStockCount: 2,
  outOfStockCount: 1,
  placeholderProductCount: 7,
  pendingPaymentCount: 3,
  time: '2026-09-12T15:00:00.000Z',
});
assert.equal(full.inventory.lowStockCount, 2);
assert.equal(full.catalog.placeholderProductCount, 7);
assert.equal(full.payments.pendingCount, 3);
assert.equal(full.time, '2026-09-12T15:00:00.000Z');

console.log('admin-ops unit tests ok');
