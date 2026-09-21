import { readFileSync } from 'fs';
import { join } from 'path';
import assert from 'assert';

const jobSrc = readFileSync(join(__dirname, 'push-scheduler.service.ts'), 'utf8');
const lockSrc = readFileSync(join(__dirname, '../orders/scheduler-lock.ts'), 'utf8');

assert.ok(jobSrc.includes('tryAcquireSchedulerLock'), 'push scheduler uses SchedulerLock');
assert.ok(jobSrc.includes("LOCK_ID = 'pushCampaignDispatch'"), 'stable lock id');
assert.ok(lockSrc.includes('SchedulerLock'), 'reuses existing SchedulerLock table');
assert.ok(jobSrc.includes('dispatchDue'), 'ticks scheduled campaigns');
assert.ok(jobSrc.includes('processDue'), 'ticks abandoned product views');

console.log('push-scheduler.spec ok');
