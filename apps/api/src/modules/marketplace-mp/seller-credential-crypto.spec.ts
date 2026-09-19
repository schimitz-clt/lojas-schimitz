import assert from 'assert';
import {
  CredentialKeyMissingError,
  decryptSecret,
  encryptSecret,
  parseCredentialKey,
} from './seller-credential-crypto';

const key = parseCredentialKey('a'.repeat(64));
assert.equal(key.length, 32);

const enc = encryptSecret('APP_USR-secret-token', key);
assert.ok(enc.startsWith('v1.'));
assert.ok(!enc.includes('APP_USR-secret-token'));
assert.equal(decryptSecret(enc, key), 'APP_USR-secret-token');

const a = encryptSecret('same', key);
const b = encryptSecret('same', key);
assert.notEqual(a, b, 'IV must randomize ciphertext');

let missing = false;
try {
  parseCredentialKey('');
} catch (e) {
  missing = e instanceof CredentialKeyMissingError;
}
assert.equal(missing, true);

let invalid = false;
try {
  parseCredentialKey('short');
} catch {
  invalid = true;
}
assert.equal(invalid, true);

console.log('seller-credential-crypto.spec ok');
