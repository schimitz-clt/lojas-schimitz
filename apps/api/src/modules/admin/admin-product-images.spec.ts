import 'reflect-metadata';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import {
  AdminAddProductImageDto,
  AdminCreateProductDto,
  AdminUpdateProductDto,
} from './dto';
import {
  CREATE_IMAGE_URL_MAX,
  PLACEHOLDER_PRODUCT_IMAGE_URL_MESSAGE,
  assertNoPlaceholderProductImageUrls,
  collectCreateImageUrls,
  coverUrlToApplyOnUpdate,
  placeholderProductImageUrlError,
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

const webOps = readFileSync(
  join(__dirname, '../../../../web/src/lib/admin-daily-ops.ts'),
  'utf8',
);
assert.ok(
  webOps.includes(PLACEHOLDER_PRODUCT_IMAGE_URL_MESSAGE),
  'admin UI uses the same PT-BR placeholder rejection',
);

const createAt = svcSrc.indexOf('async create(');
const createBlock = svcSrc.slice(createAt, updateAt);
assert.ok(
  createBlock.includes('assertNoPlaceholderProductImageUrls(imageUrls)'),
  'create rejects placeholder URLs before insert',
);
assert.ok(
  updateBlock.includes('assertNoPlaceholderProductImageUrls([coverUrl])'),
  'update rejects placeholder cover URL',
);
const addBlock = svcSrc.slice(addImageAt, svcSrc.indexOf('async deleteImage'));
assert.ok(
  addBlock.includes('assertNoPlaceholderProductImageUrls([url])'),
  'add photo from URL rejects placeholder hosts',
);

const placeholderKept = collectCreateImageUrls({
  imageUrl: 'https://placehold.co/800x800?text=Roblox',
  imageUrls: ['https://cdn.example/real.jpg'],
});
assert.deepEqual(placeholderKept, [
  'https://placehold.co/800x800?text=Roblox',
  'https://cdn.example/real.jpg',
]);

const rejectedHosts = [
  'https://placehold.co/800x800?text=Roblox',
  'https://www.placehold.co/600',
  'https://assets.placehold.co/800.png',
  'https://via.placeholder.com/800',
  'https://placehold.it/800x800',
  'https://placeholder.com/100',
  'https://www.placeholder.com/100',
  'https://PLACEHOLD.CO/1',
];
for (const url of rejectedHosts) {
  assert.equal(placeholderProductImageUrlError(url), PLACEHOLDER_PRODUCT_IMAGE_URL_MESSAGE, url);
  assert.throws(
    () => assertNoPlaceholderProductImageUrls([url]),
    (err: unknown) => {
      assert.ok(err instanceof BadRequestException, url);
      const body = (err as BadRequestException).getResponse() as { message?: string };
      assert.equal(body.message, PLACEHOLDER_PRODUCT_IMAGE_URL_MESSAGE);
      assert.equal(body.message?.startsWith('http'), false, 'must not swap in another URL');
      return true;
    },
  );
}

for (const url of [
  null,
  undefined,
  '',
  '   ',
  'https://cdn.example/a.jpg',
  'https://lojasschimitz.com.br/api/v1/uploads/518992fa-c11b-4ca5-8113-18e5a1e6c6db.png',
]) {
  assert.equal(placeholderProductImageUrlError(url), null, String(url));
}
assert.doesNotThrow(() =>
  assertNoPlaceholderProductImageUrls([
    null,
    '',
    'https://cdn.example/a.jpg',
    'https://lojasschimitz.com.br/api/v1/uploads/ok.png',
  ]),
);
assert.throws(() => assertNoPlaceholderProductImageUrls(placeholderKept), BadRequestException);

function messagesOf(errors: { constraints?: Record<string, string> }[]): string[] {
  return errors.flatMap((e) => Object.values(e.constraints || {}));
}

async function assertDtoValidation() {
  const addDto = new AdminAddProductImageDto();
  addDto.url = 'https://placehold.co/800x800?text=Roblox';
  const addMessages = messagesOf(await validate(addDto));
  assert.ok(
    addMessages.includes(PLACEHOLDER_PRODUCT_IMAGE_URL_MESSAGE),
    `add URL validation: ${addMessages.join(' | ')}`,
  );

  const addOk = new AdminAddProductImageDto();
  addOk.url = 'https://lojasschimitz.com.br/api/v1/uploads/real.jpg';
  assert.equal((await validate(addOk)).length, 0);

  const createCover = new AdminCreateProductDto();
  createCover.name = 'Smart TV';
  createCover.price = 10;
  createCover.imageUrl = 'https://placehold.co/800';
  const coverMessages = messagesOf(await validate(createCover));
  assert.ok(
    coverMessages.includes(PLACEHOLDER_PRODUCT_IMAGE_URL_MESSAGE),
    `create imageUrl validation: ${coverMessages.join(' | ')}`,
  );

  const createDto = new AdminCreateProductDto();
  createDto.name = 'Smart TV';
  createDto.price = 10;
  createDto.imageUrl = 'https://cdn.example/cover.jpg';
  createDto.imageUrls = ['https://via.placeholder.com/800'];
  const createMessages = messagesOf(await validate(createDto));
  assert.ok(
    createMessages.includes(PLACEHOLDER_PRODUCT_IMAGE_URL_MESSAGE),
    `create imageUrls validation: ${createMessages.join(' | ')}`,
  );

  const updateDto = new AdminUpdateProductDto();
  updateDto.imageUrl = 'https://placehold.it/800x800';
  const updateMessages = messagesOf(await validate(updateDto));
  assert.ok(updateMessages.includes(PLACEHOLDER_PRODUCT_IMAGE_URL_MESSAGE));

  const updateEmpty = new AdminUpdateProductDto();
  updateEmpty.imageUrl = '';
  assert.equal((await validate(updateEmpty)).length, 0, 'empty cover on update stays ignored');

  const updateReal = new AdminUpdateProductDto();
  updateReal.imageUrl = 'https://cdn.example/cover.jpg';
  assert.equal((await validate(updateReal)).length, 0);
}

assertDtoValidation()
  .then(() => {
    console.log('admin-product-images unit tests ok');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
