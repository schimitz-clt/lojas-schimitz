import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CREATE_IMAGE_URL_MAX,
  collectCreateImageUrls,
  coverUrlToApplyOnUpdate,
} from './admin-product-images';

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

assert.equal(coverUrlToApplyOnUpdate(undefined), undefined);
assert.equal(coverUrlToApplyOnUpdate(null), undefined);
assert.equal(coverUrlToApplyOnUpdate(''), undefined);
assert.equal(coverUrlToApplyOnUpdate('   '), undefined);
assert.equal(coverUrlToApplyOnUpdate('https://cdn.example/cover.jpg'), 'https://cdn.example/cover.jpg');
assert.equal(
  coverUrlToApplyOnUpdate('  https://cdn.example/cover.jpg  '),
  'https://cdn.example/cover.jpg',
);

const svcSrc = readFileSync(join(__dirname, 'admin-products.service.ts'), 'utf8');
const updateAt = svcSrc.indexOf('async update(');
const addImageAt = svcSrc.indexOf('async addImage(');
assert.ok(updateAt > 0 && addImageAt > updateAt, 'update() before addImage()');
const updateBlock = svcSrc.slice(updateAt, addImageAt);
assert.equal(
  updateBlock.includes('productImage.delete'),
  false,
  'product update must not delete ProductImage rows (empty imageUrl used to wipe Sansung A54)',
);
assert.ok(updateBlock.includes('coverUrlToApplyOnUpdate'), 'update uses coverUrlToApplyOnUpdate');
assert.ok(svcSrc.includes('async deleteImage'), 'explicit DELETE /images/:id remains');

console.log('admin-product-images unit tests ok');
