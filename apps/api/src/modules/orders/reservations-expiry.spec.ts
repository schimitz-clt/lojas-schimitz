import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';

const dir = __dirname;
const job = readFileSync(join(dir, 'reservations-expiry.service.ts'), 'utf8');
const svc = readFileSync(join(dir, 'orders.service.ts'), 'utf8');
const inv = readFileSync(join(dir, '../inventory/inventory.service.ts'), 'utf8');

assert.equal(job.includes('expireReservations'), true);
assert.equal(job.includes('transitionFromAwaiting'), false);
assert.equal(job.includes('qtyReserved'), false);
assert.equal(job.includes('releaseCoupon'), false);
assert.equal(job.includes('inventory.release'), false);
assert.equal(svc.includes("transitionFromAwaiting(o.id, 'cancelled')"), true);
assert.equal(inv.includes('AND ("qtyOnHand" - "qtyReserved") >= ${qty}'), true);

console.log('reservations-expiry static tests ok');
