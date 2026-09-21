import assert from 'assert';
import {
  fcmTokenFingerprint,
  isValidFcmToken,
  resolveTokenUserId,
  shouldDisableInvalidFcmToken,
  validateTokenUpsert,
} from './push-token.rules';

const sample = 'dKj3abc:APA91bH' + 'x'.repeat(120);
assert.equal(isValidFcmToken(sample), true);
assert.equal(isValidFcmToken('short'), false);
assert.equal(isValidFcmToken('a'.repeat(32) + ' has space'), false);
assert.equal(isValidFcmToken('a'.repeat(32) + '\n'), false);

const ok = validateTokenUpsert({ token: sample, platform: 'android', enabled: true, appVersion: '1.0.8' });
assert.equal(ok.ok, true);
if (ok.ok) {
  assert.equal(ok.value.platform, 'android');
  assert.equal(ok.value.enabled, true);
  assert.equal(ok.value.appVersion, '1.0.8');
}

const badPlat = validateTokenUpsert({ token: sample, platform: 'ios' });
assert.equal(badPlat.ok, false);
if (!badPlat.ok) assert.equal(badPlat.code, 'PUSH_PLATFORM_UNSUPPORTED');

const disabled = validateTokenUpsert({ token: sample, enabled: false });
assert.equal(disabled.ok, true);
if (disabled.ok) assert.equal(disabled.value.enabled, false);

assert.equal(resolveTokenUserId({ existingUserId: null, requestUserId: 'u1' }), 'u1');
assert.equal(resolveTokenUserId({ existingUserId: 'u-old', requestUserId: 'u-new' }), 'u-new');
assert.equal(resolveTokenUserId({ existingUserId: 'u-old', requestUserId: null }), 'u-old');
assert.equal(resolveTokenUserId({ existingUserId: null, requestUserId: null }), null);
assert.equal(resolveTokenUserId({ existingUserId: '  ', requestUserId: '' }), null);

assert.equal(fcmTokenFingerprint(sample), sample.slice(-12));
assert.equal(shouldDisableInvalidFcmToken('messaging/registration-token-not-registered'), true);
assert.equal(shouldDisableInvalidFcmToken('messaging/invalid-registration-token'), true);
assert.equal(shouldDisableInvalidFcmToken('unavailable'), false);

const missing = validateTokenUpsert({ token: '' });
assert.equal(missing.ok, false);
if (!missing.ok) assert.equal(missing.code, 'PUSH_TOKEN_INVALID');

console.log('push-token.rules tests ok');
