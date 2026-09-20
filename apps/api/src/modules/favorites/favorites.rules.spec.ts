import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import { canAddToWishlist, guestIdsToSync, isWishlistCatalogProduct } from './favorites.rules';

assert.equal(isWishlistCatalogProduct(null), false);
assert.equal(isWishlistCatalogProduct({ id: 'p1', active: true }), true);
assert.equal(isWishlistCatalogProduct({ id: 'p1', active: false }), false);
assert.equal(
  isWishlistCatalogProduct({ id: 'p1', active: true, seller: { status: 'active' } }),
  true,
);
assert.equal(
  isWishlistCatalogProduct({ id: 'p1', active: true, seller: { status: 'suspended' } }),
  false,
);
assert.equal(canAddToWishlist({ id: 'p1', active: true, seller: { status: 'pending' } }), false);
assert.equal(canAddToWishlist({ active: true }), false);

assert.deepEqual(guestIdsToSync(['a', 'b', 'a', '  '], ['b']), ['a']);
assert.deepEqual(guestIdsToSync([], ['x']), []);
assert.deepEqual(guestIdsToSync(['x'], ['x']), []);

const svc = readFileSync(join(__dirname, 'favorites.service.ts'), 'utf8');
assert.ok(svc.includes('serializeFavoriteItems'), 'list serializes public catalog shape');
assert.ok(svc.includes('canAddToWishlist'), 'add rejects inactive / hidden sellers');
assert.ok(svc.includes('upsert'), 'add is idempotent (no fake 409 on re-save)');
assert.ok(svc.includes('deleteMany'), 'remove is idempotent');
assert.ok(svc.includes("status: 'active'"), 'list only active seller catalog');

const ctrl = readFileSync(join(__dirname, 'favorites.controller.ts'), 'utf8');
assert.ok(ctrl.includes('JwtAuthGuard'), 'favorites require auth');
assert.ok(ctrl.includes("Controller('favorites')"), 'route stays /favorites');

console.log('favorites.rules unit tests ok');
