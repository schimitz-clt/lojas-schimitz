import assert from 'assert';
import { buildCustomerWhere, clampTake } from './admin-customers.service';

assert.deepEqual(buildCustomerWhere(undefined), { role: 'customer' });
assert.deepEqual(buildCustomerWhere('  '), { role: 'customer' });

const w = buildCustomerWhere('Ana');
assert.equal(w.role, 'customer');
assert.ok(Array.isArray(w.OR));
assert.equal((w.OR as any[]).length, 3);

assert.equal(clampTake(undefined), 50);
assert.equal(clampTake(0), 50);
assert.equal(clampTake(-1), 50);
assert.equal(clampTake(10), 10);
assert.equal(clampTake(999), 100);
assert.equal(clampTake(3.9), 3);

console.log('admin-customers unit ok');
