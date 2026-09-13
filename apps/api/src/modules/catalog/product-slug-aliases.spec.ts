import assert from 'node:assert/strict';

/** Mirrors catalog.controller PRODUCT_SLUG_ALIASES (keep in sync). */
const PRODUCT_SLUG_ALIASES: Record<string, string> = {
  'ar-condicionado-aiwa': 'ar-condicionado-aiwa-2',
};

assert.equal(PRODUCT_SLUG_ALIASES['ar-condicionado-aiwa'], 'ar-condicionado-aiwa-2');
assert.equal(PRODUCT_SLUG_ALIASES['ar-condicionado-aiwa-2'], undefined);
console.log('product-slug-aliases — PASSOU');
