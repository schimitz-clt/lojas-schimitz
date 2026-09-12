import assert from 'assert';
import {
  DEFAULT_OPS_LOW_STOCK_THRESHOLD,
  countPlaceholderProducts,
  isLowOnHand,
  isMissingOrPlaceholderImage,
  isPlaceholderImageUrl,
  listPlaceholderProducts,
  summarizeInventoryOps,
  summarizeOps,
  summarizeOrderStatusCounts,
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
assert.deepEqual(full.catalog.placeholderProducts, []);
assert.equal(full.payments.pendingCount, 3);
assert.equal(full.mail.configured, false);
assert.equal(full.time, '2026-09-12T15:00:00.000Z');

const listed = listPlaceholderProducts([
  { id: 'a', name: 'Roblox', images: [{ url: 'https://placehold.co/1' }] },
  { id: 'b', name: 'Real', images: [{ url: 'https://lojasschimitz.com.br/api/v1/uploads/ok.png' }] },
  { id: 'c', name: 'Sem foto', images: [] },
]);
assert.deepEqual(listed, [
  { id: 'a', name: 'Roblox' },
  { id: 'c', name: 'Sem foto' },
]);

const withList = summarizeOps({
  lowStockCount: 0,
  outOfStockCount: 0,
  placeholderProductCount: listed.length,
  placeholderProducts: listed,
  pendingPaymentCount: 0,
  time: '2026-09-12T18:00:00.000Z',
  mailConfigured: true,
});
assert.equal(withList.catalog.placeholderProductCount, 2);
assert.equal(withList.catalog.placeholderProducts[0].id, 'a');
assert.equal(withList.catalog.placeholderProducts[1].name, 'Sem foto');
assert.equal(withList.mail.configured, true);

const orderCounts = summarizeOrderStatusCounts([
  { status: 'paid', count: 2 },
  { status: 'organizing', count: 1 },
  { status: 'cancelled', count: 3 },
  { status: 'shipped', count: 1 },
  { status: 'awaiting_payment', count: 4 },
]);
assert.equal(orderCounts.byStatus.paid, 2);
assert.equal(orderCounts.buckets.paid, 2);
assert.equal(orderCounts.buckets.organizing, 1);
assert.equal(orderCounts.buckets.awaiting_payment, 4);
assert.equal(orderCounts.buckets.problems, 4); // cancelled 3 + shipped 1
assert.equal(orderCounts.total, 11);

const withOrders = summarizeOps({
  lowStockCount: 0,
  outOfStockCount: 0,
  placeholderProductCount: 0,
  pendingPaymentCount: 0,
  orderStatusCounts: [
    { status: 'paid', count: 5 },
    { status: 'delivered', count: 2 },
  ],
  mailConfigured: false,
});
assert.equal(withOrders.orders.buckets.paid, 5);
assert.equal(withOrders.orders.buckets.delivered, 2);
assert.equal(withOrders.orders.total, 7);

console.log('admin-ops unit tests ok');
