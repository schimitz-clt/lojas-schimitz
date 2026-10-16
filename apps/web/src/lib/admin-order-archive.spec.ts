import assert from 'assert';
import { archiveResultMessage, canArchiveOrder, parseOrderView } from './admin-order-archive';
import { buildAdminOrdersQueryPath } from './admin-order-search';

assert.equal(parseOrderView(null), 'ativos');
assert.equal(parseOrderView('arquivados'), 'arquivados');
assert.equal(parseOrderView('x'), 'ativos');
assert.ok(canArchiveOrder({ status: 'cancelled' }));
assert.ok(canArchiveOrder({ status: 'delivered' }));
for (const s of ['paid', 'awaiting_payment', 'organizing', 'packing', 'in_transit'])
  assert.ok(!canArchiveOrder({ status: s }), s);
assert.ok(!canArchiveOrder({ status: 'cancelled', archivedAt: '2026-10-16' }));
assert.equal(buildAdminOrdersQueryPath({}), '/admin/orders');
assert.equal(buildAdminOrdersQueryPath({ view: 'arquivados' }), '/admin/orders?view=arquivados');
assert.equal(buildAdminOrdersQueryPath({ view: 'ativos' }), '/admin/orders');
assert.equal(archiveResultMessage(true, 2, []), '2 pedido(s) arquivado(s).');
assert.ok(archiveResultMessage(true, 0, [{ publicId: 'SCH-1', reason: 'x' }]).includes('SCH-1'));
console.log('admin-order-archive: PASSOU');
import { activeTabTotal } from './admin-order-archive';
assert.equal(activeTabTotal(6, 13), 6, 'Todos = ativos');
assert.equal(activeTabTotal(undefined, 13), null, 'sem dado não usa total geral');
console.log('admin-order-archive Todos: PASSOU');
