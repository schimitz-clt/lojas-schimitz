import assert from 'assert';
import {
  classifyFcmError,
  isMassInvalidation,
  shouldDisableInvalidFcmToken,
} from './push-token.rules';
import { deactivateDeadTokens, summarizeDeadTokens } from './push-token-cleanup';
import { PushFcmClient } from './push-fcm.client';

const tok = (n: number) => `tok_${String(n).padStart(3, '0')}_${'x'.repeat(40)}`;

async function main() {
  // --- classification: permanent token errors → deactivate
  assert.equal(classifyFcmError('messaging/registration-token-not-registered'), 'invalid_token');
  assert.equal(classifyFcmError('messaging/invalid-registration-token'), 'invalid_token');
  assert.equal(classifyFcmError('messaging/unregistered'), 'invalid_token');
  assert.equal(classifyFcmError('MESSAGING/REGISTRATION-TOKEN-NOT-REGISTERED'), 'invalid_token');
  assert.equal(
    classifyFcmError('messaging/invalid-argument', 'The registration token is not a valid FCM registration token'),
    'invalid_token',
  );
  // invalid-argument about the MESSAGE (bad image URL / payload) must not kill tokens
  assert.equal(classifyFcmError('messaging/invalid-argument', 'Invalid value at message.android.notification.image'), 'payload');
  assert.equal(classifyFcmError('messaging/invalid-argument'), 'payload');
  assert.equal(shouldDisableInvalidFcmToken('messaging/invalid-argument', 'Request contains an invalid argument.'), false);
  // transient / config errors never deactivate
  for (const c of [
    'messaging/unavailable',
    'messaging/internal-error',
    'messaging/server-unavailable',
    'messaging/quota-exceeded',
    'messaging/message-rate-exceeded',
    'messaging/device-message-rate-exceeded',
    'messaging/mismatched-credential',
    'messaging/third-party-auth-error',
    'app/network-error',
    'send_error',
    'NÃO EXECUTADO',
    '',
    null,
    undefined,
  ]) {
    assert.equal(shouldDisableInvalidFcmToken(c as string), false, `must keep token on ${String(c)}`);
  }
  assert.equal(classifyFcmError('messaging/unavailable'), 'transient');
  assert.equal(classifyFcmError('messaging/something-new'), 'unknown');

  // --- mass-invalidation guard
  assert.equal(isMassInvalidation(1, 1), false, 'single-device sends are never blocked');
  assert.equal(isMassInvalidation(9, 9), false);
  assert.equal(isMassInvalidation(86, 3), false, "today's campaign: 3 of 86 dead is normal");
  assert.equal(isMassInvalidation(86, 43), false, 'exactly 50% is still allowed');
  assert.equal(isMassInvalidation(86, 44), true);
  assert.equal(isMassInvalidation(10, 0), false);

  // --- summarize + deactivate (fake store, no DB)
  const s = summarizeDeadTokens([
    { id: 'a', token: tok(1), errorCode: 'messaging/registration-token-not-registered' },
    { id: 'a', token: tok(1), errorCode: 'messaging/registration-token-not-registered' },
    { id: 'b', token: tok(2), errorCode: 'messaging/invalid-registration-token' },
  ]);
  assert.deepEqual(s.ids, ['a', 'b']);
  assert.deepEqual(s.reasons, {
    'messaging/registration-token-not-registered': 1,
    'messaging/invalid-registration-token': 1,
  });
  assert.ok(s.fingerprints.every((f) => f.length === 12), 'only 12-char fingerprints are logged');

  const calls: unknown[] = [];
  const store = {
    deviceFcmToken: {
      updateMany: async (args: { where: { id: { in: string[] }; enabled: boolean }; data: { enabled: boolean } }) => {
        calls.push(args);
        return { count: args.where.id.in.length };
      },
    },
  };
  assert.equal(await deactivateDeadTokens(store, [], 'campaign'), 0);
  assert.equal(calls.length, 0, 'no DB call when nothing is dead');
  const n = await deactivateDeadTokens(
    store,
    [
      { id: 'a', token: tok(1), errorCode: 'messaging/registration-token-not-registered' },
      { id: 'a', token: tok(1), errorCode: 'messaging/registration-token-not-registered' },
    ],
    'campaign',
  );
  assert.equal(n, 1);
  assert.deepEqual(calls[0], {
    where: { id: { in: ['a'] }, enabled: true },
    data: { enabled: false },
  }, 'soft-deactivate only (enabled=false), idempotent, never delete');

  // --- FCM client end-to-end with a fake Firebase messaging
  const client = new PushFcmClient();
  const fake = (responses: Array<{ success: boolean; messageId?: string; error?: { code?: string; message?: string } }>) => {
    (client as unknown as { ready: boolean; messaging: unknown }).ready = true;
    (client as unknown as { ready: boolean; messaging: unknown }).messaging = {
      sendEachForMulticast: async () => ({
        successCount: responses.filter((r) => r.success).length,
        failureCount: responses.filter((r) => !r.success).length,
        responses,
      }),
    };
  };
  const msg = { title: 't', body: 'b', data: {} };

  // like today's 07:58 campaign: 83 ok + 3 not-registered → exactly those 3 flagged
  fake([
    ...Array.from({ length: 83 }, (_, i) => ({ success: true, messageId: `m${i}` })),
    ...Array.from({ length: 3 }, () => ({ success: false, error: { code: 'messaging/registration-token-not-registered', message: 'Requested entity was not found.' } })),
  ]);
  let res = await client.sendToTokens(Array.from({ length: 86 }, (_, i) => tok(i)), msg);
  assert.equal(res.results.filter((r) => r.disableToken).length, 3);
  assert.deepEqual(res.results.filter((r) => r.disableToken).map((r) => r.token), [tok(83), tok(84), tok(85)]);

  // transient outage for everyone → nobody flagged
  fake(Array.from({ length: 20 }, () => ({ success: false, error: { code: 'messaging/unavailable', message: 'unavailable' } })));
  res = await client.sendToTokens(Array.from({ length: 20 }, (_, i) => tok(i)), msg);
  assert.equal(res.results.filter((r) => r.disableToken).length, 0);

  // bad payload (invalid-argument for every token) → nobody flagged
  fake(Array.from({ length: 20 }, () => ({ success: false, error: { code: 'messaging/invalid-argument', message: 'Invalid value at message.android.notification.image' } })));
  res = await client.sendToTokens(Array.from({ length: 20 }, (_, i) => tok(i)), msg);
  assert.equal(res.results.filter((r) => r.disableToken).length, 0);

  // suspicious: 15 of 20 "not registered" → guard blocks, nobody flagged
  fake([
    ...Array.from({ length: 5 }, () => ({ success: true, messageId: 'm' })),
    ...Array.from({ length: 15 }, () => ({ success: false, error: { code: 'messaging/registration-token-not-registered' } })),
  ]);
  res = await client.sendToTokens(Array.from({ length: 20 }, (_, i) => tok(i)), msg);
  assert.equal(res.results.filter((r) => r.disableToken).length, 0, 'mass invalidation blocked');

  // single-device send (test push / product recovery) with a dead token → flagged
  fake([{ success: false, error: { code: 'messaging/registration-token-not-registered' } }]);
  res = await client.sendToTokens([tok(1)], msg);
  assert.equal(res.results[0].disableToken, true);

  // whole-request exception (network) → nobody flagged
  (client as unknown as { messaging: unknown }).messaging = {
    sendEachForMulticast: async () => {
      throw new Error('socket hang up');
    },
  };
  res = await client.sendToTokens([tok(1), tok(2)], msg);
  assert.equal(res.results.filter((r) => r.disableToken).length, 0);

  console.log('push-token-cleanup tests ok');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
