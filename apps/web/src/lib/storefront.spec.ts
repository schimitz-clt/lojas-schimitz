import assert from 'node:assert/strict';
import { publicProductCategorySlug, publicProductId, siteOrigin } from './storefront';

const prev = process.env.NEXT_PUBLIC_SITE_URL;

process.env.NEXT_PUBLIC_SITE_URL = 'https://www.lojasschimitz.com.br/';
assert.equal(siteOrigin(), 'https://lojasschimitz.com.br');

process.env.NEXT_PUBLIC_SITE_URL = 'https://lojasschimitz.com.br';
assert.equal(siteOrigin(), 'https://lojasschimitz.com.br');

process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
assert.equal(siteOrigin(), 'http://localhost:3000');

if (prev === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
else process.env.NEXT_PUBLIC_SITE_URL = prev;

assert.equal(publicProductId({ id: 'abc' }), 'abc');
assert.equal(publicProductId({}), null);
assert.equal(publicProductCategorySlug({ category: { slug: 'eletro' } }), 'eletro');
assert.equal(publicProductCategorySlug({ category: null }), null);

console.log('storefront siteOrigin unit tests ok');
