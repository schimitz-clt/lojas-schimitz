import assert from 'assert';
import { isMissingOrPlaceholderImage, isPlaceholderImageUrl } from './placeholder-image';

assert.equal(isPlaceholderImageUrl(null), false);
assert.equal(isPlaceholderImageUrl(''), false);
assert.equal(isPlaceholderImageUrl('   '), false);
assert.equal(isPlaceholderImageUrl('https://placehold.co/800x800?text=Roblox'), true);
assert.equal(isPlaceholderImageUrl('https://www.placehold.co/600'), true);
assert.equal(isPlaceholderImageUrl('https://assets.placehold.co/800.png'), true);
assert.equal(isPlaceholderImageUrl('https://via.placeholder.com/800'), true);
assert.equal(isPlaceholderImageUrl('https://placehold.it/800x800'), true);
assert.equal(isPlaceholderImageUrl('null'), true);
assert.equal(isPlaceholderImageUrl('#'), true);
assert.equal(
  isPlaceholderImageUrl(
    'https://lojasschimitz.com.br/api/v1/uploads/518992fa-c11b-4ca5-8113-18e5a1e6c6db.png',
  ),
  false,
);

assert.equal(isMissingOrPlaceholderImage(null), true);
assert.equal(isMissingOrPlaceholderImage(''), true);
assert.equal(isMissingOrPlaceholderImage('   '), true);
assert.equal(isMissingOrPlaceholderImage('https://placehold.co/1'), true);
assert.equal(
  isMissingOrPlaceholderImage(
    'https://lojasschimitz.com.br/api/v1/uploads/518992fa-c11b-4ca5-8113-18e5a1e6c6db.png',
  ),
  false,
);

console.log('placeholder-image unit tests ok');
