import assert from 'assert';
import {
  buildAdminOrdersQueryPath,
  isPublicIdLike,
  shouldServerOrderSearch,
} from './admin-order-search';

assert.equal(isPublicIdLike('SCH-1'), true);
assert.equal(isPublicIdLike('x'), false);
assert.equal(shouldServerOrderSearch('ab'), false);
assert.equal(shouldServerOrderSearch('abc'), true);
assert.equal(shouldServerOrderSearch('SCH'), true);

assert.equal(buildAdminOrdersQueryPath({}), '/admin/orders');
assert.equal(buildAdminOrdersQueryPath({ status: 'paid' }), '/admin/orders?status=paid');
assert.equal(
  buildAdminOrdersQueryPath({ q: 'ab' }),
  '/admin/orders',
  'short q must not hit server search param',
);
assert.ok(buildAdminOrdersQueryPath({ q: 'SCH-ABC' }).includes('q=SCH-ABC'));
assert.ok(buildAdminOrdersQueryPath({ status: 'paid', q: 'ana@x.com' }).includes('status=paid'));
assert.ok(buildAdminOrdersQueryPath({ status: 'paid', q: 'ana@x.com' }).includes('q=ana'));

console.log('admin-order-search web unit ok');
