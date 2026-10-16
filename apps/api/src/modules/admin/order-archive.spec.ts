import assert from 'assert';
import { adminOrderViewWhere, isArchivableStatus, planOrderArchive } from './order-archive';

assert.deepEqual(adminOrderViewWhere(undefined, { hasSearch: false, hasStatus: false }), {
  archivedAt: null,
  status: { notIn: ['cancelled', 'refunded'] },
});
assert.deepEqual(adminOrderViewWhere('encerrados', { hasSearch: false, hasStatus: false }), {
  archivedAt: null,
  status: { in: ['cancelled', 'refunded'] },
});
assert.deepEqual(adminOrderViewWhere('arquivados', { hasSearch: false, hasStatus: false }), { archivedAt: { not: null } });
assert.deepEqual(adminOrderViewWhere('ativos', { hasSearch: true, hasStatus: false }), {}, 'busca acha tudo');
assert.deepEqual(adminOrderViewWhere('ativos', { hasSearch: false, hasStatus: true }), { archivedAt: null });
for (const s of ['awaiting_payment', 'paid', 'organizing', 'packing', 'ready_for_pickup', 'in_transit', 'draft'])
  assert.ok(!isArchivableStatus(s), `${s} não arquiva`);
for (const s of ['cancelled', 'refunded', 'delivered']) assert.ok(isArchivableStatus(s));
const now = new Date();
const orders = [
  { id: 'a', publicId: 'SCH-A', status: 'cancelled' },
  { id: 'b', publicId: 'SCH-B', status: 'paid' },
  { id: 'c', publicId: 'SCH-C', status: 'delivered', archivedAt: now },
];
const p = planOrderArchive(orders, ['a', 'b', 'c', 'x', 'a'], true);
assert.deepEqual(p.apply, ['a']);
assert.equal(p.skipped.length, 3);
assert.deepEqual(planOrderArchive(orders, ['a', 'c'], false).apply, ['c']);
console.log('order-archive: PASSOU');
