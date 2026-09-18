import assert from 'node:assert/strict';
import {
  SEARCH_SUGGEST_DEBOUNCE_MS,
  SEARCH_SUGGEST_MIN,
  buildSuggestionRows,
  catalogSearchHref,
  categoriesFromListResponse,
  categorySuggestHref,
  filterCategorySuggestions,
  nextSuggestionIndex,
  normalizeSearchQuery,
  productSuggestHref,
  productsFromListResponse,
  rankProductSuggestions,
  shouldFetchSuggestions,
  suggestionsStatusLabel,
} from './search-suggestions';

assert.ok(SEARCH_SUGGEST_MIN >= 2);
assert.ok(SEARCH_SUGGEST_DEBOUNCE_MS >= 200);

assert.equal(normalizeSearchQuery('  TêVê  '), 'teve');
assert.equal(shouldFetchSuggestions('t'), false);
assert.equal(shouldFetchSuggestions('tv'), true);
assert.equal(shouldFetchSuggestions('  '), false);

assert.equal(catalogSearchHref('tv 50'), '/produtos?q=tv%2050');
assert.equal(catalogSearchHref(''), '/produtos');
assert.equal(productSuggestHref('tv-a'), '/produto/tv-a');
assert.equal(categorySuggestHref('celulares'), '/departamento/celulares');

assert.deepEqual(
  productsFromListResponse({
    items: [
      { id: '1', slug: 'tv-a', name: 'TV A', category: { name: 'TVs e Áudio', slug: 'eletro' } },
    ],
    total: 1,
  }).map((p) => p.slug),
  ['tv-a'],
);
assert.equal(productsFromListResponse([{ id: '1', slug: 'x', name: 'X' }]).length, 1);
assert.deepEqual(productsFromListResponse(null), []);
assert.equal(categoriesFromListResponse([{ id: 'c', name: 'Celulares', slug: 'celulares' }]).length, 1);

const ranked = rankProductSuggestions(
  [
    { id: '1', slug: 'fone', name: 'Fone Bluetooth', category: { name: 'Áudio', slug: 'eletro' } },
    { id: '2', slug: 'tv-50', name: 'TV 50 polegadas', category: { name: 'TVs e Áudio', slug: 'eletro' } },
    { id: '3', slug: 'geladeira', name: 'Geladeira Frost', category: { name: 'Eletrodomésticos', slug: 'eletrodomesticos' } },
    { id: '2', slug: 'tv-50', name: 'dup' },
  ],
  'tv',
  6,
);
assert.equal(ranked[0].slug, 'tv-50');
assert.ok(ranked.every((p) => p.id !== 'dup'));

const cats = filterCategorySuggestions(
  [
    { id: '1', name: 'Celulares', slug: 'celulares' },
    { id: '2', name: 'TVs e Áudio', slug: 'eletro' },
    { id: '3', name: 'Casa', slug: 'casa' },
  ],
  'tv',
);
assert.equal(cats.length, 1);
assert.equal(cats[0].slug, 'eletro');
assert.deepEqual(filterCategorySuggestions(cats, 'x'), []);

const rows = buildSuggestionRows({
  q: 'tv',
  products: ranked,
  categories: [
    { id: '2', name: 'TVs e Áudio', slug: 'eletro' },
    { id: '1', name: 'Celulares', slug: 'celulares' },
  ],
});
assert.equal(rows[0].kind, 'category');
assert.ok(rows.some((r) => r.kind === 'product' && r.href.includes('/produto/')));
assert.equal(rows[rows.length - 1].kind, 'all');
assert.ok(rows[rows.length - 1].label.includes('tv'));

assert.equal(nextSuggestionIndex(-1, 3, 1), 0);
assert.equal(nextSuggestionIndex(2, 3, 1), -1);
assert.equal(nextSuggestionIndex(-1, 3, -1), 2);
assert.equal(nextSuggestionIndex(0, 0, 1), -1);

assert.ok(suggestionsStatusLabel({ q: 'tv', loading: true, count: 0 }).includes('Buscando'));
assert.ok(suggestionsStatusLabel({ q: 'tv', loading: false, count: 0 }).includes('Nenhuma'));
assert.equal(suggestionsStatusLabel({ q: 'tv', loading: false, count: 2 }), '2 sugestões');
assert.equal(suggestionsStatusLabel({ q: 't', loading: false, count: 2 }), '');

console.log('search-suggestions unit tests ok');
