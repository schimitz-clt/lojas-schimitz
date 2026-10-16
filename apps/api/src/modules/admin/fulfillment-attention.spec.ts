import assert from 'node:assert/strict';
import { summarizeFulfillmentAttention, fulfillmentStuckDays } from './fulfillment-attention';

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
console.log('fulfillment-attention.spec ok');
