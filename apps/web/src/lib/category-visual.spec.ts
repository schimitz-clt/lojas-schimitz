import assert from 'node:assert/strict';
import {
  HOME_CATEGORIES,
  categoryCircleSrc,
  pickFeaturedHeroProduct,
  resolveRealProductImageUrl,
} from './category-visual';

assert.equal(HOME_CATEGORIES.length, 8);
assert.ok(HOME_CATEGORIES.some((c) => c.label === 'Eletrodomésticos'));
assert.ok(HOME_CATEGORIES.some((c) => c.label === 'TVs e Áudio' && c.slug === 'eletro'));

const aiwa = {
  name: 'Ar-condicionado aiwa',
  slug: 'ar-condicionado-aiwa',
  image: 'https://cdn.example.com/uploads/aiwa.png',
  price: 1999,
  compareAtPrice: 2499,
  category: { slug: 'eletrodomesticos', name: 'Eletrodomésticos' },
};
const placeholder = {
  name: 'TV Demo',
  slug: 'tv-demo',
  image: 'https://placehold.co/800x800',
  price: 100,
};

assert.equal(resolveRealProductImageUrl(aiwa), 'https://cdn.example.com/uploads/aiwa.png');
assert.equal(resolveRealProductImageUrl(placeholder), '');

const eletro = HOME_CATEGORIES.find((c) => c.slug === 'eletrodomesticos')!;
assert.equal(categoryCircleSrc([aiwa, placeholder], eletro), aiwa.image);

const ofertas = HOME_CATEGORIES.find((c) => c.slug === 'ofertas')!;
assert.equal(categoryCircleSrc([aiwa], ofertas), aiwa.image);

const featured = pickFeaturedHeroProduct([placeholder, aiwa]);
assert.equal(featured?.name, 'Ar-condicionado aiwa');

const cel = HOME_CATEGORIES.find((c) => c.slug === 'celulares')!;
assert.equal(categoryCircleSrc([], cel), '/cats/celulares.svg');

console.log('category-visual unit tests ok');
