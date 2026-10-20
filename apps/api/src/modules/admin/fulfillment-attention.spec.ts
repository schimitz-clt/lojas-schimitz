import assert from 'node:assert/strict';
import { summarizeFulfillmentAttention, fulfillmentStuckDays, listStalledOrders } from './fulfillment-attention';

const now = new Date('2026-10-16T12:00:00Z');
const d = (days: number) => new Date(now.getTime() - days * 86_400_000);
const s = summarizeFulfillmentAttention(
  [
    { publicId: 'A1', status: 'organizing', since: d(4), trackingCode: null },
    { publicId: 'A2', status: 'packing', since: d(1), trackingCode: null },
    { publicId: 'A3', status: 'separating', since: d(3), trackingCode: null },
    { publicId: 'B1', status: 'in_transit', since: d(1), trackingCode: '  ' },
    { publicId: 'B2', status: 'shipped', since: d(1), trackingCode: 'QB123BR' },
    { publicId: 'C1', status: 'paid', since: d(10), trackingCode: null },
    { publicId: 'C2', status: 'delivered', since: d(10), trackingCode: null },
  ],
  now,
  3,
);
assert.deepEqual(s.prepStuckPublicIds, ['A1', 'A3']);
assert.equal(s.prepStuckCount, 2);
assert.deepEqual(s.shippedNoTrackingPublicIds, ['B1']);
assert.equal(summarizeFulfillmentAttention([], now).prepStuckCount, 0);
assert.equal(fulfillmentStuckDays({}), 3);
assert.equal(fulfillmentStuckDays({ FULFILLMENT_STUCK_DAYS: '5' }), 5);
assert.equal(fulfillmentStuckDays({ FULFILLMENT_STUCK_DAYS: '0' }), 3);
assert.equal(fulfillmentStuckDays({ FULFILLMENT_STUCK_DAYS: 'x' }), 3);
{
  const h = (hrs: number) => new Date(now.getTime() - hrs * 3_600_000);
  const rows = [
    { id: 'u1', publicId: 'P1', status: 'paid', since: h(30), trackingCode: null, customerName: 'Ana', total: 10.5 },
    { id: 'u2', publicId: 'P2', status: 'paid', since: h(5), trackingCode: null },
    { id: 'u3', publicId: 'S1', status: 'organizing', since: h(80), trackingCode: null },
    { id: 'u4', publicId: 'S2', status: 'packing', since: h(10), trackingCode: null },
    { id: 'u5', publicId: 'T1', status: 'shipped', since: h(2), trackingCode: '' },
    { id: 'u6', publicId: 'T2', status: 'in_transit', since: h(2), trackingCode: 'QB1BR' },
    { id: 'u7', publicId: 'D1', status: 'delivered', since: h(500), trackingCode: null },
    { id: 'u8', publicId: 'X1', status: 'paid', since: new Date('invalid'), trackingCode: null },
  ];
  const l = listStalledOrders(rows, now, { paidHours: 24, stuckDays: 3 });
  assert.deepEqual(l.map((i) => i.publicId), ['S1', 'P1', 'T1'], 'mais antigos primeiro, só parados');
  assert.deepEqual(l.map((i) => i.reason), ['prep_stuck', 'paid_awaiting_org', 'shipped_no_tracking']);
  assert.equal(l[1].id, 'u1');
  assert.equal(l[1].ageHours, 30);
  assert.equal(l[1].customerName, 'Ana');
  assert.equal(l[1].total, 10.5);
  assert.equal(l[0].customerName, null);
  assert.deepEqual(listStalledOrders([], now, { paidHours: 24, stuckDays: 3 }), []);
}
console.log('fulfillment-attention.spec ok');
