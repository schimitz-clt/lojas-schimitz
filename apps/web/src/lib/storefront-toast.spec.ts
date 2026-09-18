import assert from 'node:assert/strict';
import { parseToastPayload } from './storefront-toast';

assert.equal(parseToastPayload(null), null);
assert.equal(parseToastPayload({}), null);
assert.deepEqual(parseToastPayload({ message: '  Salvo nos favoritos.  ' }), {
  message: 'Salvo nos favoritos.',
  href: undefined,
  hrefLabel: undefined,
  tone: 'ok',
});
assert.equal(parseToastPayload({ message: 'Ops', tone: 'warn', href: '/entrar', hrefLabel: 'Entrar' })?.tone, 'warn');
assert.equal(parseToastPayload({ message: 'Ok', href: '  /favoritos  ' })?.href, '/favoritos');

console.log('storefront-toast unit tests ok');
