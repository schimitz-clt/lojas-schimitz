import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buyNowLabel, stickyBuyLabel } from './storefront-pro';
import { productCardAddLabel } from './product-card-cues';
import { cartHasDemoItem, catalogSplitCounts, isDemoCatalogProduct, DEMO_PURCHASE_BLOCK_MESSAGE } from './demo-catalog';
import { suggestionCanQuickAdd } from './search-suggestions';

assert.equal(isDemoCatalogProduct({ isDemo: true }), true);
assert.equal(isDemoCatalogProduct({ isDemo: false }), false);
assert.equal(isDemoCatalogProduct(null), false);
assert.equal(cartHasDemoItem([{ isDemo: false }, { isDemo: true }]), true);
assert.equal(cartHasDemoItem([{ isDemo: false }]), false);

const split = catalogSplitCounts([
  { isDemo: true, active: true },
  { isDemo: true, active: false },
  { isDemo: false, active: true },
  { active: true },
]);
assert.equal(split.demo, 2);
assert.equal(split.sellable, 2);
assert.equal(split.real, 2);

assert.equal(productCardAddLabel({ outOfStock: false, adding: false, added: false, demo: true }), 'Não disponível');
assert.equal(buyNowLabel({ outOfStock: false, adding: false, demo: true }), 'Não disponível');
assert.equal(stickyBuyLabel({ outOfStock: true, adding: false, addedToBag: false, demo: true }), 'Não disponível');
assert.equal(suggestionCanQuickAdd({ id: '1', stock: 9, isDemo: true }), false);
assert.equal(suggestionCanQuickAdd({ id: '1', stock: 9, isDemo: false }), true);
assert.ok(DEMO_PURCHASE_BLOCK_MESSAGE.includes('vitrine'));

const card = readFileSync(join(__dirname, '../components/ProductCard.tsx'), 'utf8');
const pdp = readFileSync(join(__dirname, '../app/produto/[slug]/ProductClient.tsx'), 'utf8');
assert.ok(card.includes('isDemoCatalogProduct'));
assert.ok(card.includes('DEMO_SEAL_LABEL'));
assert.ok(pdp.includes('DEMO_PURCHASE_BLOCK_MESSAGE'));
assert.ok(pdp.includes('demo || outOfStock'));

console.log('demo-catalog web unit tests ok');
