import assert from 'node:assert/strict';
import {
  activeFilterCount,
  buildFilterChips,
  cartCheckoutLabel,
  cartTrustItems,
  catalogSortLabel,
  departmentTitle,
  discountPercent,
  emptySearchSuggestions,
  formatPriceRangeChip,
  parseCatalogSort,
  pixHighlight,
  searchEmptyCopy,
  searchResultsHeading,
  stickyBuyLabel,
} from './storefront-pro';

assert.equal(discountPercent(100, 200), 50);
assert.equal(discountPercent(100, 100), null);
assert.equal(discountPercent(100, 80), null);
assert.equal(discountPercent(0, 100), null);
assert.equal(discountPercent('90', '100'), 10);

const h = pixHighlight(100);
assert.equal(h.list, 100);
assert.equal(h.pix, 95);
assert.equal(h.savings, 5);
assert.equal(h.tag, '5% OFF');
assert.ok(h.savingsLine.includes('Economize'));
assert.ok(h.savingsLine.includes('PIX'));

const trust = cartTrustItems();
assert.equal(trust.length, 3);
assert.ok(trust.every((t) => t.title && t.sub));
assert.ok(trust.some((t) => /PIX/i.test(t.title)));

assert.equal(stickyBuyLabel({ outOfStock: true, adding: false, addedToBag: false }), 'Indisponível');
assert.equal(stickyBuyLabel({ outOfStock: false, adding: true, addedToBag: false }), 'Adicionando...');
assert.equal(
  stickyBuyLabel({ outOfStock: false, adding: false, addedToBag: true }),
  'Ir para a sacola',
);
assert.equal(
  stickyBuyLabel({ outOfStock: false, adding: false, addedToBag: false }),
  'Adicionar à sacola',
);

assert.equal(cartCheckoutLabel(true), 'Finalizar compra');
assert.equal(cartCheckoutLabel(false), 'Entrar ou cadastrar');

/* —— Phase 2 —— */
assert.equal(parseCatalogSort('price_asc'), 'price_asc');
assert.equal(parseCatalogSort('nope'), 'relevance');
assert.equal(catalogSortLabel('newest'), 'Mais recentes');
assert.equal(catalogSortLabel(undefined), 'Relevância');

assert.equal(departmentTitle('celulares', 'Celulares'), 'Celulares');
assert.equal(departmentTitle('tvs-e-audio'), 'Tvs e audio');
assert.equal(departmentTitle(''), 'Departamento');

const loadingHead = searchResultsHeading('tv', 0, { loading: true });
assert.ok(loadingHead.title.includes('Buscando'));
assert.ok(loadingHead.subtitle.toLowerCase().includes('carregando'));

const foundHead = searchResultsHeading('tv', 3);
assert.equal(foundHead.title, 'Resultados para “tv”');
assert.ok(foundHead.subtitle.includes('3'));

const catHead = searchResultsHeading('', 12, { categoryName: 'Celulares' });
assert.equal(catHead.title, 'Celulares');
assert.ok(catHead.subtitle.includes('12'));

const emptyQ = searchEmptyCopy('xyz', false);
assert.ok(emptyQ.title.includes('xyz'));
assert.ok(emptyQ.body.length > 10);

const emptyFilters = searchEmptyCopy('', true);
assert.ok(/filtros/i.test(emptyFilters.title) || /filtros/i.test(emptyFilters.body));

assert.equal(formatPriceRangeChip('', ''), null);
assert.ok(formatPriceRangeChip('100', '500')!.includes('100'));
assert.ok(formatPriceRangeChip('100', '')!.toLowerCase().includes('partir'));
assert.ok(formatPriceRangeChip('', '200')!.toLowerCase().includes('até'));

const chips = buildFilterChips({
  q: 'iphone',
  category: 'celulares',
  categoryName: 'Celulares',
  minPrice: '500',
  maxPrice: '3000',
  sort: 'price_asc',
});
assert.equal(chips.length, 4);
assert.ok(chips.some((c) => c.clearKey === 'q' && c.label.includes('iphone')));
assert.ok(chips.some((c) => c.clearKey === 'category' && c.label === 'Celulares'));
assert.ok(chips.some((c) => c.clearKey === 'price'));
assert.ok(chips.some((c) => c.clearKey === 'sort'));
assert.equal(activeFilterCount({ q: 'a', sort: 'relevance' }), 1);
assert.equal(activeFilterCount({}), 0);

const suggestions = emptySearchSuggestions();
assert.ok(suggestions.length >= 4);
assert.ok(suggestions.every((s) => s.href.startsWith('/') && s.label));

console.log('storefront-pro unit tests ok');
