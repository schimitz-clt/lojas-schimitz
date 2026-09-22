import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  FCM_REGISTER_BACKOFF_MS,
  FCM_REGISTER_MAX_ATTEMPTS,
  FCM_REGISTER_THROTTLE_MS,
  fcmRegisterBackoffBeforeAttempt,
  fcmTokenLogFingerprint,
  shouldEnqueueFcmRegister,
} from './push-register.policy';

const TOKEN_A = 'dKj3abc:APA91bH' + 'x'.repeat(100) + 'TOKENAAA';
const TOKEN_B = 'dKj3abc:APA91bH' + 'y'.repeat(100) + 'TOKENBBB';
const NOW = 1_700_000_000_000;

assert.equal(FCM_REGISTER_MAX_ATTEMPTS, 3);
assert.equal(FCM_REGISTER_THROTTLE_MS, 15 * 60 * 1000);
assert.deepEqual([...FCM_REGISTER_BACKOFF_MS], [0, 2_000, 4_000]);
assert.equal(fcmRegisterBackoffBeforeAttempt(1), 0);
assert.equal(fcmRegisterBackoffBeforeAttempt(2), 2_000);
assert.equal(fcmRegisterBackoffBeforeAttempt(3), 4_000);
assert.equal(fcmRegisterBackoffBeforeAttempt(4), 4_000);

const base = {
  force: false,
  token: TOKEN_A,
  lastSuccessToken: null as string | null,
  lastSuccessMs: 0,
  nowMs: NOW,
  inFlightToken: null as string | null,
  inFlightCount: 0,
};

assert.equal(shouldEnqueueFcmRegister({ ...base, token: '   ' }), false);
assert.equal(shouldEnqueueFcmRegister({ ...base, token: '', force: true }), false);
assert.equal(shouldEnqueueFcmRegister(base), true, 'first upsert after reinstall');

assert.equal(
  shouldEnqueueFcmRegister({
    ...base,
    lastSuccessToken: TOKEN_A,
    lastSuccessMs: NOW - 60_000,
  }),
  false,
  'same token inside 15 min',
);

assert.equal(
  shouldEnqueueFcmRegister({
    ...base,
    lastSuccessToken: TOKEN_A,
    lastSuccessMs: NOW - FCM_REGISTER_THROTTLE_MS,
  }),
  true,
  'same token after throttle window refreshes lastSeen',
);

assert.equal(
  shouldEnqueueFcmRegister({
    ...base,
    force: true,
    lastSuccessToken: TOKEN_A,
    lastSuccessMs: NOW - 1_000,
    inFlightToken: TOKEN_A,
    inFlightCount: 1,
  }),
  true,
  'force (grant / onNewToken) bypasses throttle and in-flight',
);

assert.equal(
  shouldEnqueueFcmRegister({
    ...base,
    inFlightToken: TOKEN_A,
    inFlightCount: 1,
  }),
  false,
  'duplicate resume while the same token is posting',
);

assert.equal(
  shouldEnqueueFcmRegister({
    ...base,
    token: TOKEN_B,
    lastSuccessToken: TOKEN_A,
    lastSuccessMs: NOW - 1_000,
    inFlightToken: TOKEN_A,
    inFlightCount: 1,
  }),
  true,
  'a new token is not dropped behind the previous upsert',
);

assert.equal(
  shouldEnqueueFcmRegister({
    ...base,
    lastSuccessToken: TOKEN_A,
    lastSuccessMs: 0,
  }),
  true,
  'failed upsert does not start the throttle (no success timestamp)',
);

const fp = fcmTokenLogFingerprint(TOKEN_A);
assert.ok(fp.startsWith('…'));
assert.ok(fp.includes('TOKENAAA'));
assert.ok(fp.includes(`len=${TOKEN_A.length}`));
assert.equal(fp.includes(TOKEN_A), false);
assert.equal(fp.includes('APA91b'), false);
assert.equal(fcmTokenLogFingerprint('short'), 'len=5');
assert.equal(fcmTokenLogFingerprint('  short  '), 'len=5');
assert.equal(fcmTokenLogFingerprint(''), 'len=0');

const policyKt = readFileSync(
  join(__dirname, '../../../../apps/mobile/app/src/main/java/com/lojasschimitz/app/PushRegisterPolicy.kt'),
  'utf8',
);
assert.ok(policyKt.includes('SYNC: apps/web/src/lib/push-register.policy.ts'));
assert.ok(policyKt.includes('MAX_ATTEMPTS = 3'));
assert.ok(policyKt.includes('THROTTLE_MS = 15 * 60 * 1000L'));
assert.ok(policyKt.includes('0L, 2_000L, 4_000L'));
assert.ok(policyKt.includes('if (trimmed.isEmpty()) return false'));
assert.ok(policyKt.includes('if (force) return true'));
assert.ok(policyKt.includes('inFlightCount > 0 && inFlightToken == trimmed'));
assert.ok(policyKt.includes('lastSuccessToken != trimmed'));
assert.ok(policyKt.includes('trimmed.length < 12'));
assert.ok(policyKt.includes('takeLast(8)'));

console.log('push-register.policy tests ok');
