import assert from 'node:assert/strict';
import { CREATE_IMAGE_URL_MAX, collectCreateImageUrls } from './admin-product-images';

assert.equal(CREATE_IMAGE_URL_MAX, 10);

assert.deepEqual(collectCreateImageUrls({}), []);
assert.deepEqual(collectCreateImageUrls({ imageUrl: '  ' }), []);
assert.deepEqual(collectCreateImageUrls({ imageUrl: 'https://cdn.example/a.jpg' }), [
  'https://cdn.example/a.jpg',
]);

const multi = collectCreateImageUrls({
  imageUrl: 'https://cdn.example/a.jpg',
  imageUrls: [
    'https://cdn.example/a.jpg',
    'https://cdn.example/b.jpg',
    '  https://cdn.example/c.jpg  ',
    '',
    'https://cdn.example/b.jpg',
  ],
});
assert.deepEqual(multi, [
  'https://cdn.example/a.jpg',
  'https://cdn.example/b.jpg',
  'https://cdn.example/c.jpg',
]);

const extrasOnly = collectCreateImageUrls({
  imageUrls: ['https://cdn.example/1.jpg', 'https://cdn.example/2.jpg'],
});
assert.equal(extrasOnly.length, 2);

const capped = collectCreateImageUrls(
  {
    imageUrls: Array.from({ length: 15 }, (_, i) => `https://cdn.example/${i}.jpg`),
  },
  10,
);
assert.equal(capped.length, 10);
assert.equal(capped[0], 'https://cdn.example/0.jpg');
assert.equal(capped[9], 'https://cdn.example/9.jpg');

console.log('admin-product-images unit tests ok');
