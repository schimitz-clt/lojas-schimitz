import assert from 'node:assert/strict';
import { resolveProductSlugRedirect, PRODUCT_SLUG_REDIRECTS } from './product-slug-redirects';

assert.equal(resolveProductSlugRedirect('ar-condicionado-aiwa'), 'ar-condicionado-aiwa-2');
assert.equal(resolveProductSlugRedirect('AR-CONDICIONADO-AIWA'), 'ar-condicionado-aiwa-2');
assert.equal(resolveProductSlugRedirect('ar-condicionado-aiwa-2'), null);
assert.equal(resolveProductSlugRedirect(''), null);
assert.ok(PRODUCT_SLUG_REDIRECTS['ar-condicionado-aiwa']);
console.log('product-slug-redirects unit tests ok');
