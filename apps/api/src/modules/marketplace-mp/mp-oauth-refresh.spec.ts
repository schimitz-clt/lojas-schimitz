import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';

const jobSrc = readFileSync(join(__dirname, 'mp-oauth-refresh.service.ts'), 'utf8');
assert.ok(jobSrc.includes('tryAcquireSchedulerLock'), 'refresh job uses SchedulerLock');
assert.ok(jobSrc.includes('isMarketplaceSplitEnabled'), 'refresh job gated by flag');
assert.ok(jobSrc.includes("reason: 'flag_off'"), 'flag off is a no-op');
assert.ok(jobSrc.includes('this.oauth.refreshDue'), 'job delegates to OAuth service');
assert.ok(!/application_fee/.test(jobSrc), 'refresh job must not charge');

const svcSrc = readFileSync(join(__dirname, 'mp-oauth.service.ts'), 'utf8');
assert.ok(svcSrc.includes('refreshSellerAccessToken'), 'service refreshes tokens');
assert.ok(svcSrc.includes('refreshTokenEnc'), 'must persist the new refresh token');

console.log('mp-oauth-refresh.spec ok');
