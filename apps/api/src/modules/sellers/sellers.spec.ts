import assert from 'assert';
import {
  canSetSellerStatus,
  isPublicSellerVisible,
  publicSellerListItem,
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

assert.equal(isPublicSellerVisible('active'), true);
assert.equal(isPublicSellerVisible('pending'), false);
assert.equal(isPublicSellerVisible('suspended'), false);
assert.equal(isPublicSellerVisible(null), false);

const listed = publicSellerListItem({
  id: '1',
  name: 'Lojas Schimitz',
  slug: 'lojas-schimitz',
  productCount: 9,
});
assert.deepEqual(listed, {
  id: '1',
  name: 'Lojas Schimitz',
  slug: 'lojas-schimitz',
  productCount: 9,
});
assert.ok(!('owner' in listed));
assert.ok(!('commissionPercent' in listed));
assert.ok(!('status' in listed));

console.log('sellers.spec ok');
