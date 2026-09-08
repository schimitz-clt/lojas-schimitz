import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';

const lockSrc = readFileSync(join(__dirname, 'scheduler-lock.ts'), 'utf8');
const jobSrc = readFileSync(join(__dirname, 'reservations-expiry.service.ts'), 'utf8');

assert.ok(lockSrc.includes('SchedulerLock'), 'table name');
assert.ok(lockSrc.includes('ON CONFLICT'), 'upsert lease');
assert.ok(lockSrc.includes('expiresAt'), 'ttl');
assert.ok(!lockSrc.includes('pg_try_advisory_lock'), 'no session advisory (pool-unsafe)');
assert.ok(jobSrc.includes('tryAcquireSchedulerLock'), 'job uses lease');
assert.ok(jobSrc.includes('expireReservations'), 'still delegates expire');
assert.ok(jobSrc.includes('MULTI_REPLICA'), 'documents multi-replica');

console.log('scheduler-lock static tests ok');
