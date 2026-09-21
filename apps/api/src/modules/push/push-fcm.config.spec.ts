import assert from 'assert';
import {
  firebaseAdminConfiguredFromEnv,
  firebaseConfiguredFromEnvPresence,
  readFirebaseServiceAccountJson,
} from './push-fcm.config';

const empty = firebaseAdminConfiguredFromEnv({});
assert.equal(empty.configured, false);
assert.equal(empty.reason, 'missing');
assert.equal(firebaseConfiguredFromEnvPresence({}), false);

const junk = firebaseAdminConfiguredFromEnv({ FIREBASE_SERVICE_ACCOUNT_JSON: '{not-json' });
assert.equal(junk.configured, false);
assert.equal(junk.reason, 'json_invalid');

const noKey = firebaseAdminConfiguredFromEnv({
  FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 'x', client_email: 'a@b.com' }),
});
assert.equal(noKey.configured, false);

const sa = {
  type: 'service_account',
  project_id: 'lojas-schimitz',
  private_key: '-----BEGIN PRIVATE KEY-----\\nfake\\n-----END PRIVATE KEY-----\\n',
  client_email: 'firebase-adminsdk@lojas-schimitz.iam.gserviceaccount.com',
};
const ok = firebaseAdminConfiguredFromEnv({
  FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify(sa),
});
assert.equal(ok.configured, true);
assert.equal(ok.source, 'json');
assert.equal(ok.projectId, 'lojas-schimitz');
assert.equal(ok.reason, 'ok');

const b64 = Buffer.from(JSON.stringify(sa), 'utf8').toString('base64');
const fromB64 = firebaseAdminConfiguredFromEnv({ FIREBASE_SERVICE_ACCOUNT_BASE64: b64 });
assert.equal(fromB64.configured, true);
assert.equal(fromB64.source, 'base64');

const adc = firebaseAdminConfiguredFromEnv({ GOOGLE_APPLICATION_CREDENTIALS: '/secret/sa.json' });
assert.equal(adc.configured, true);
assert.equal(adc.source, 'adc_path');

const decoded = readFirebaseServiceAccountJson({ FIREBASE_SERVICE_ACCOUNT_BASE64: b64 });
assert.ok(decoded && decoded.includes('client_email'));
assert.equal(readFirebaseServiceAccountJson({}), null);

assert.equal(JSON.stringify(ok).includes('BEGIN PRIVATE KEY'), false);

console.log('push-fcm.config tests ok');
