import assert from 'node:assert/strict';
import { STOREFRONT_SECURITY_HEADERS } from './storefront-security-headers';

const keys = STOREFRONT_SECURITY_HEADERS.map((h) => h.key);
for (const need of [
  'X-Content-Type-Options',
  'X-Frame-Options',
  'Referrer-Policy',
  'Permissions-Policy',
  'Strict-Transport-Security',
]) {
  assert.ok(keys.includes(need), `missing ${need}`);
}
assert.equal(
  STOREFRONT_SECURITY_HEADERS.find((h) => h.key === 'X-Frame-Options')?.value,
  'SAMEORIGIN',
);
assert.ok(
  STOREFRONT_SECURITY_HEADERS.find((h) => h.key === 'Strict-Transport-Security')?.value.includes(
    'max-age=',
  ),
);
console.log('storefront-security-headers tests ok');
