/**
 * Process-local store-notify mail failure ring — ops snapshot only.
 * Never stores recipient addresses or secrets.
 */
import assert from 'assert';
import {
  STORE_NOTIFY_MAIL_FAILURE_CAP,
  recordStoreNotifyMailFailure,
  resetStoreNotifyMailOpsForTests,
  summarizeStoreNotifyMailOps,
} from './store-notify-mail-ops';

resetStoreNotifyMailOpsForTests();
assert.deepEqual(summarizeStoreNotifyMailOps(), { recentFailures: [], failureCount: 0 });

const a = recordStoreNotifyMailFailure({
  code: 'STORE_EMAIL_SEND_FAILED',
  publicId: 'SCH-1',
  reason: 'send_failed',
  at: '2026-09-18T12:00:00.000Z',
});
assert.equal(a.publicId, 'SCH-1');
assert.equal(summarizeStoreNotifyMailOps().failureCount, 1);

recordStoreNotifyMailFailure({
  code: 'STORE_EMAIL_SEND_FAILED',
  publicId: 'SCH-1',
  reason: 'send_failed',
  at: '2026-09-18T12:05:00.000Z',
});
assert.equal(summarizeStoreNotifyMailOps().failureCount, 1, 'same publicId+code replaces');
assert.equal(summarizeStoreNotifyMailOps().recentFailures[0].at, '2026-09-18T12:05:00.000Z');

recordStoreNotifyMailFailure({
  code: 'STORE_EMAIL_NO_RECIPIENTS',
  publicId: 'SCH-2',
  reason: 'no_recipients',
});
assert.equal(summarizeStoreNotifyMailOps().failureCount, 2);

for (let i = 0; i < STORE_NOTIFY_MAIL_FAILURE_CAP + 5; i += 1) {
  recordStoreNotifyMailFailure({
    code: 'MAIL_PROVIDER_OFF',
    publicId: `SCH-CAP-${i}`,
    reason: 'provider_off',
  });
}
assert.equal(summarizeStoreNotifyMailOps().failureCount, STORE_NOTIFY_MAIL_FAILURE_CAP);

const dumped = JSON.stringify(summarizeStoreNotifyMailOps());
assert.equal(dumped.includes('@'), false, 'no e-mail addresses in ops dump');
assert.equal(dumped.toLowerCase().includes('resend_api_key'), false);

resetStoreNotifyMailOpsForTests();
assert.equal(summarizeStoreNotifyMailOps().failureCount, 0);

console.log('store-notify-mail-ops: ring buffer — PASSOU');
