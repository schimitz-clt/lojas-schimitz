import assert from 'assert';
import { serializeFavoriteItem, serializeFavoriteItems } from './favorites.serialize';

const createdAt = new Date('2026-09-20T12:00:00.000Z');
const row = {
  id: 'fav-1',
  productId: 'b4982259-15d8-47e3-bb97-8ce0c68f8939',
  createdAt,
  product: {
    id: 'b4982259-15d8-47e3-bb97-8ce0c68f8939',
    slug: 'roblox',
    name: 'Roblox',
    price: '99.9',
    images: [{ url: 'https://cdn.example/roblox.jpg', position: 0 }],
    inventory: { qtyOnHand: 12, qtyReserved: 2, warehouse: 'origin-91250' },
    seller: { id: 's1', name: 'Lojas Schimitz', slug: 'lojas-schimitz', status: 'active' },
    category: { id: 'c1', name: 'Games', slug: 'games' },
  },
};

const out = serializeFavoriteItem(row);
assert.equal(out.id, 'fav-1');
assert.equal(out.productId, row.productId);
assert.equal(out.createdAt.toISOString(), createdAt.toISOString());
assert.equal(out.product.stock, 10);
assert.equal(out.product.image, 'https://cdn.example/roblox.jpg');
assert.equal(out.product.imageUrl, out.product.image);
assert.deepEqual(out.product.inventory, { available: 10 });
assert.deepEqual(out.product.seller, { id: 's1', name: 'Lojas Schimitz', slug: 'lojas-schimitz' });
assert.ok(!('status' in (out.product.seller as object)));
assert.equal('qtyOnHand' in (out.product.inventory as object), false);

const list = serializeFavoriteItems([row]);
assert.equal(list.length, 1);
assert.equal(list[0].product.slug, 'roblox');

console.log('favorites.serialize unit tests ok');
