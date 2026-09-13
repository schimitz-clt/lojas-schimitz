import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import { shouldSkipReservationExpiry } from './reservation-expiry-policy';

const dir = __dirname;
const job = readFileSync(join(dir, 'reservations-expiry.service.ts'), 'utf8');
const svc = readFileSync(join(dir, 'orders.service.ts'), 'utf8');
const inv = readFileSync(join(dir, '../inventory/inventory.service.ts'), 'utf8');
const lock = readFileSync(join(dir, 'scheduler-lock.ts'), 'utf8');

assert.equal(job.includes('expireReservations'), true);
assert.equal(job.includes('transitionFromAwaiting'), false);
assert.equal(job.includes('qtyReserved'), false);
assert.equal(job.includes('releaseCoupon'), false);
assert.equal(job.includes('inventory.release'), false);
assert.equal(job.includes('tryAcquireSchedulerLock'), true);
assert.equal(job.includes('MULTI_REPLICA'), true);
assert.equal(svc.includes("transitionFromAwaiting(o.id, 'cancelled')"), true);
assert.equal(svc.includes('shouldSkipReservationExpiry'), true);
assert.equal(inv.includes('AND ("qtyOnHand" - "qtyReserved") >= ${qty}'), true);
assert.equal(lock.includes('SchedulerLock'), true);
assert.equal(lock.includes('pg_try_advisory_lock'), false);

const now = new Date('2026-09-13T12:00:00.000Z');
const expiredAt = new Date('2026-09-13T11:30:00.000Z');
assert.equal(
  shouldSkipReservationExpiry({ hasPendingPayment: true, reservationExpiresAt: expiredAt, now }),
  true,
  'pending PIX still settling — do not cancel',
);
assert.equal(
  shouldSkipReservationExpiry({ hasPendingPayment: false, reservationExpiresAt: expiredAt, now }),
  false,
  'no pending payment — expire',
);
assert.equal(
  shouldSkipReservationExpiry({
    hasPendingPayment: true,
    reservationExpiresAt: new Date('2026-09-13T09:00:00.000Z'),
    now,
  }),
  false,
  'grace elapsed — expire even with pending',
);

console.log('reservations-expiry static tests ok');
