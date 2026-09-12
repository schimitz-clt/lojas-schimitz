import assert from 'assert';
import {
  ME_PATCH_ALLOWED_KEYS,
  OWNERSHIP_CODES,
  denyIfNotOwner,
  filterMePatchKeys,
  isAdminRole,
  sameOwner,
} from './ownership';

assert.equal(sameOwner('u1', 'u1'), true);
assert.equal(sameOwner('u1', 'u2'), false);
assert.equal(sameOwner('u1', null), false);
assert.equal(sameOwner('', 'u1'), false);
assert.equal(sameOwner('  u1  ', 'u1'), true);

const own = denyIfNotOwner('a', 'a', OWNERSHIP_CODES.ORDER_NOT_FOUND, 'Pedido não encontrado');
assert.deepEqual(own, { ok: true });

const cross = denyIfNotOwner('a', 'b', OWNERSHIP_CODES.ORDER_NOT_FOUND, 'Pedido não encontrado');
assert.deepEqual(cross, {
  ok: false,
  code: 'ORDER_NOT_FOUND',
  message: 'Pedido não encontrado',
});

const missing = denyIfNotOwner('a', undefined, OWNERSHIP_CODES.ADDRESS_NOT_FOUND, 'Endereço não encontrado');
assert.equal(missing.ok, false);
if (!missing.ok) assert.equal(missing.code, 'ADDRESS_NOT_FOUND');

assert.equal(isAdminRole('admin'), true);
assert.equal(isAdminRole('ADMIN'), true);
assert.equal(isAdminRole('customer'), false);
assert.equal(isAdminRole('seller'), false);
assert.equal(isAdminRole(undefined), false);

assert.deepEqual([...ME_PATCH_ALLOWED_KEYS].sort(), ['name', 'phone'].sort());
const filtered = filterMePatchKeys({
  name: 'Ana',
  phone: '11999999999',
  role: 'admin',
  email: 'evil@x.com',
  status: 'active',
  cashbackBalance: 999,
});
assert.deepEqual(filtered.allowed, { name: 'Ana', phone: '11999999999' });
assert.ok(filtered.rejected.includes('role'));
assert.ok(filtered.rejected.includes('email'));
assert.ok(filtered.rejected.includes('status'));
assert.ok(filtered.rejected.includes('cashbackBalance'));

console.log('ownership unit tests ok');
