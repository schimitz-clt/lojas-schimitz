import assert from 'assert';
import {
  DEFAULT_OPS_LOW_STOCK_THRESHOLD,
  countPlaceholderProducts,
  deriveOpsAlerts,
  isLowOnHand,
  isMissingOrPlaceholderImage,
  isPlaceholderImageUrl,
  listPlaceholderProducts,
  placeholderProductsCsv,
  summarizeInventoryOps,
  summarizeOps,
  summarizeOrderStatusCounts,
  summarizeSalesWindow,
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
  { id: 'a', name: 'Roblox', imageUrl: 'https://placehold.co/1' },
  { id: 'c', name: 'Sem foto', imageUrl: '' },
]);

const csv = placeholderProductsCsv(listed);
assert.equal(csv.filename, 'products-needing-photos.csv');
assert.ok(csv.csv.startsWith('id,name,imageUrl\n'));
assert.ok(csv.csv.includes('a,Roblox,https://placehold.co/1'));
assert.ok(csv.csv.includes('c,Sem foto,'));
assert.ok(!csv.csv.includes('fake-photo'));

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


const salesWin = summarizeSalesWindow({
  from: '2026-09-12',
  to: '2026-09-12',
  orderCount: 2,
  revenue: 199.995,
});
assert.equal(salesWin.orderCount, 2);
assert.equal(salesWin.revenue, 200);
assert.equal(salesWin.from, '2026-09-12');

const emptyAlerts = deriveOpsAlerts({
  lowStockCount: 0,
  outOfStockCount: 0,
  placeholderProductCount: 0,
  pendingPaymentCount: 0,
  mailConfigured: true,
  orderBuckets: {},
});
assert.deepEqual(emptyAlerts, []);

const richAlerts = deriveOpsAlerts({
  lowStockCount: 3,
  outOfStockCount: 1,
  placeholderProductCount: 2,
  pendingPaymentCount: 4,
  mailConfigured: false,
  orderBuckets: { paid: 5, problems: 2, awaiting_payment: 4 },
});
assert.equal(richAlerts.some((a) => a.code === 'out_of_stock' && a.severity === 'critical'), true);
assert.equal(richAlerts.some((a) => a.code === 'low_stock' && a.count === 3), true);
assert.equal(richAlerts.some((a) => a.code === 'pending_payments' && a.queueBucket === 'awaiting_payment'), true);
assert.equal(richAlerts.some((a) => a.code === 'paid_needs_organizing' && a.queueBucket === 'paid'), true);
assert.equal(richAlerts.some((a) => a.code === 'order_problems' && a.severity === 'critical'), true);
assert.equal(richAlerts.some((a) => a.code === 'placeholder_photos'), true);
assert.equal(richAlerts.some((a) => a.code === 'mail_not_configured'), true);
assert.equal(richAlerts.some((a) => a.code === 'awaiting_payment_orders'), true);

const dash = summarizeOps({
  lowStockCount: 1,
  outOfStockCount: 0,
  placeholderProductCount: 0,
  pendingPaymentCount: 2,
  orderStatusCounts: [
    { status: 'paid', count: 3 },
    { status: 'awaiting_payment', count: 2 },
  ],
  mailConfigured: true,
  salesToday: salesWin,
  salesLast30d: summarizeSalesWindow({
    from: '2026-08-14',
    to: '2026-09-12',
    orderCount: 10,
    revenue: 1500,
  }),
});
assert.equal(dash.sales.today?.revenue, 200);
assert.equal(dash.sales.last30d?.orderCount, 10);
assert.equal(dash.alerts.some((a) => a.code === 'paid_needs_organizing' && a.count === 3), true);
assert.equal(dash.alerts.some((a) => a.code === 'pending_payments' && a.count === 2), true);
assert.equal(dash.mail.configured, true);
assert.equal(dash.orders.buckets.paid, 3);

console.log('admin-ops unit tests ok');
