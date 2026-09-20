import assert from 'node:assert/strict';
import {
  addGuestWishlistItem,
  guestIdsToSync,
  guestSnapsToWishlistItems,
  guestWishlistHas,
  guestWishlistIds,
  parseGuestWishlist,
  removeGuestWishlistItem,
  snapshotGuestWishlistProduct,
} from './wishlist-guest';

const snap = snapshotGuestWishlistProduct({
  id: 'p1',
  slug: 'tv-a',
  name: 'TV A',
  price: 1999,
  image: 'https://cdn.example/tv.jpg',
});
assert.ok(snap);
assert.equal(snap?.id, 'p1');
assert.equal(snap?.image, 'https://cdn.example/tv.jpg');
assert.equal(snapshotGuestWishlistProduct({ id: 'x', name: 'No slug' }), null);

const listed = addGuestWishlistItem(
  [],
  {
    id: 'p1',
    slug: 'tv-a',
    name: 'TV A',
    price: 10,
  },
  100,
);
assert.equal(listed.length, 1);
assert.equal(guestWishlistHas(listed, 'p1'), true);
assert.deepEqual(guestWishlistIds(listed), ['p1']);

const dup = addGuestWishlistItem(listed, { id: 'p1', slug: 'tv-a', name: 'TV A', price: 11 }, 200);
assert.equal(dup.length, 1);
assert.equal(dup[0].savedAt, 200);

const two = addGuestWishlistItem(dup, { id: 'p2', slug: 'tv-b', name: 'TV B', price: 20 }, 300);
assert.equal(two.length, 2);
assert.deepEqual(guestWishlistIds(two), ['p2', 'p1']);

const removed = removeGuestWishlistItem(two, 'p2');
assert.deepEqual(guestWishlistIds(removed), ['p1']);

const parsed = parseGuestWishlist([
  { id: 'p1', slug: 'a', name: 'A', price: 1, savedAt: 1 },
  { id: 'p1', slug: 'a', name: 'A', price: 1, savedAt: 9 },
  { foo: 1 },
]);
assert.equal(parsed.length, 1);
assert.equal(parsed[0].savedAt, 9);

const items = guestSnapsToWishlistItems(parsed);
assert.equal(items[0].id, 'guest:p1');
assert.equal(items[0].product.slug, 'a');

assert.deepEqual(guestIdsToSync(['a', 'b', 'a'], ['b']), ['a']);
assert.deepEqual(guestIdsToSync(['x'], ['x']), []);

console.log('wishlist-guest unit tests ok');
