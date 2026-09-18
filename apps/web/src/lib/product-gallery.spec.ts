import assert from 'node:assert/strict';
import {
  buildProductGallery,
  clampGalleryIndex,
  galleryAriaLabel,
  galleryCloseLabel,
  galleryCounterLabel,
  galleryOpenLabel,
  galleryZoomHint,
  nextGalleryIndex,
} from './product-gallery';

const empty = buildProductGallery({ name: 'TV' });
assert.deepEqual(empty, []);

const fromFlat = buildProductGallery({
  name: 'TV 50',
  image: 'https://cdn.example/tv.jpg',
});
assert.equal(fromFlat.length, 1);
assert.equal(fromFlat[0].url, 'https://cdn.example/tv.jpg');
assert.equal(fromFlat[0].alt, 'TV 50');

const multi = buildProductGallery({
  name: 'Fone',
  images: [
    { url: 'https://cdn.example/b.jpg', position: 2, alt: 'Lado' },
    { url: 'https://cdn.example/a.jpg', position: 1 },
    { url: 'https://placehold.co/400', position: 0 },
    { url: 'https://cdn.example/a.jpg', position: 3 },
  ],
});
assert.equal(multi.length, 2);
assert.equal(multi[0].url, 'https://cdn.example/a.jpg');
assert.equal(multi[0].alt, 'Fone');
assert.equal(multi[1].url, 'https://cdn.example/b.jpg');
assert.equal(multi[1].alt, 'Lado');

assert.equal(nextGalleryIndex(0, 3, 1), 1);
assert.equal(nextGalleryIndex(2, 3, 1), 0);
assert.equal(nextGalleryIndex(0, 3, -1), 2);
assert.equal(nextGalleryIndex(0, 0, 1), 0);
assert.equal(clampGalleryIndex(9, 3), 2);
assert.equal(clampGalleryIndex(-1, 3), 0);

assert.equal(galleryCounterLabel(0, 4), 'Foto 1 de 4');
assert.equal(galleryCounterLabel(3, 4), 'Foto 4 de 4');
assert.equal(galleryCounterLabel(0, 0), 'Sem fotos');
assert.ok(galleryAriaLabel('Geladeira', 1, 3).includes('Foto 2 de 3'));
assert.ok(galleryAriaLabel('Geladeira', 0, 1).includes('Geladeira'));
assert.equal(galleryZoomHint(false), 'Toque para ampliar');
assert.equal(galleryZoomHint(true), 'Toque para reduzir');
assert.ok(galleryOpenLabel().toLowerCase().includes('ampliar'));
assert.ok(galleryCloseLabel().toLowerCase().includes('fechar'));

console.log('product-gallery unit tests ok');
