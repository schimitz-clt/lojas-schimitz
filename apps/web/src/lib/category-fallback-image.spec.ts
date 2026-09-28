import assert from 'node:assert/strict';
import { categoryFallbackImage } from './category-fallback-image';

assert.equal(categoryFallbackImage('celulares'), '/cats/celulares.svg');
assert.equal(categoryFallbackImage('Eletro'), '/cats/eletro.svg');
assert.equal(categoryFallbackImage('tv-e-video'), '/cats/eletro.svg');
assert.equal(categoryFallbackImage(''), '/cats/marketplace.svg');
assert.equal(categoryFallbackImage(null), '/cats/marketplace.svg');
assert.equal(categoryFallbackImage('categoria-nova'), '/cats/marketplace.svg');

console.log('category-fallback-image unit tests ok');
