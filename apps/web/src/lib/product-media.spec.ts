import assert from 'node:assert/strict';
import { resolveProductImageUrl, resolveProductStock, stockCompareLabel } from './product-media';

assert.equal(resolveProductImageUrl({}), '');
assert.equal(resolveProductImageUrl({ image: '  ' }), '');
assert.equal(resolveProductImageUrl({ imageUrl: 'https://placehold.co/400' }), '');
assert.equal(
  resolveProductImageUrl({
    images: [{ url: '', position: 0 }, { url: 'https://cdn.example/a.jpg', position: 2 }],
    image: 'https://cdn.example/flat.jpg',
  }),
  'https://cdn.example/a.jpg',
);
assert.equal(
  resolveProductImageUrl({ image: 'https://cdn.example/flat.jpg' }),
  'https://cdn.example/flat.jpg',
);

assert.equal(resolveProductStock({}), null);
assert.equal(resolveProductStock({ stock: null }), null);
assert.equal(resolveProductStock({ stock: 7 }), 7);
assert.equal(resolveProductStock({ inventory: { qtyOnHand: 10, qtyReserved: 3 } }), 7);
assert.equal(resolveProductStock({ inventory: { qtyOnHand: 2, qtyReserved: 9 } }), 0);
assert.equal(resolveProductStock({ stock: 4, inventory: { qtyOnHand: 99, qtyReserved: 0 } }), 4);

assert.equal(stockCompareLabel(null), 'Sob consulta');
assert.equal(stockCompareLabel(undefined), 'Sob consulta');
assert.equal(stockCompareLabel(0), 'Esgotado');
assert.equal(stockCompareLabel(3), 'Últimas unidades (3)');
assert.equal(stockCompareLabel(12), 'Em estoque (12)');

console.log('product-media unit tests ok');
