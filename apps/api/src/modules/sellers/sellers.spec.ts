import assert from 'assert';
import {
  canSetSellerStatus,
  publicSellerShape,
  slugifySellerName,
  DEFAULT_SELLER_SLUG,
  DEFAULT_SELLER_NAME,
} from './sellers.constants';

assert.equal(slugifySellerName('Lojas Schimitz'), 'lojas-schimitz');
assert.equal(slugifySellerName('  Parceiro Centro!! '), 'parceiro-centro');
assert.equal(DEFAULT_SELLER_SLUG, 'lojas-schimitz');
assert.equal(DEFAULT_SELLER_NAME, 'Lojas Schimitz');

assert.ok(canSetSellerStatus('pending', 'active'));
assert.ok(canSetSellerStatus('active', 'suspended'));
assert.ok(canSetSellerStatus('suspended', 'active'));
assert.ok(!canSetSellerStatus('active', 'bogus'));

const pub = publicSellerShape({
  id: '1',
  name: 'Lojas Schimitz',
  slug: 'lojas-schimitz',
});
assert.deepEqual(pub, { id: '1', name: 'Lojas Schimitz', slug: 'lojas-schimitz' });
assert.ok(!('status' in pub));

console.log('sellers.spec ok');
