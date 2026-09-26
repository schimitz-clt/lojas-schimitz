import assert from 'node:assert/strict';
import {
  isNotaFiscalTrust,
  isValidCnpj,
  normalizeCnpj,
  parsePromoEndsAt,
  parsePromoLines,
  parseTrustItems,
  trustItemsForPublic,
} from './store-settings';

assert.equal(isValidCnpj(''), false);
assert.equal(isValidCnpj('00000000000000'), false);
assert.equal(isValidCnpj('11.222.333/0001-81'), true);
assert.equal(normalizeCnpj('11.222.333/0001-81'), '11222333000181');
assert.equal(normalizeCnpj('11222333000180'), null);
assert.equal(normalizeCnpj(''), null);

assert.equal(parsePromoEndsAt(''), null);
assert.equal(parsePromoEndsAt('not-a-date'), null);
assert.ok(parsePromoEndsAt('2026-12-31T23:59:00.000Z') instanceof Date);

assert.deepEqual(parsePromoLines(['  Frete grátis em POA  ', '', 'x'.repeat(80)]), [
  'Frete grátis em POA',
  'x'.repeat(48),
]);
assert.equal(parsePromoLines(['a', 'b', 'c', 'd', 'e']).length, 4);

const trust = parseTrustItems([
  { title: 'Compra segura', body: 'Pagamento pelo Mercado Pago.' },
  { title: 'Nota fiscal', body: 'Emitida no CNPJ da loja.' },
  { title: 'x', body: 'curto demais no título' },
]);
assert.equal(trust.length, 2);
assert.equal(isNotaFiscalTrust(trust[1]), true);
assert.equal(trustItemsForPublic(trust, null)?.length, 1);
assert.equal(trustItemsForPublic(trust, '11222333000181')?.length, 2);
assert.equal(trustItemsForPublic([], null), null);

console.log('store-settings unit tests ok');
