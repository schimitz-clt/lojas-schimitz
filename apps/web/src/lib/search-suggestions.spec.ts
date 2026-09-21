import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SEARCH_SUGGEST_DEBOUNCE_MS,
  SEARCH_SUGGEST_MIN,
  buildSuggestionRows,
  catalogSearchHref,
  categoriesFromListResponse,
  categorySuggestHref,
  filterCategorySuggestions,
  focusCategoryShortcuts,
  focusFallbackShortcuts,
  focusHighlightRows,
  formatSuggestionMoney,
  hasCatalogSuggestionHits,
  highlightProductsFromShelves,
  nextSuggestionIndex,
  normalizeSearchQuery,
  productSuggestHref,
  productSuggestionImage,
  productsFromListResponse,
  rankProductSuggestions,
  searchFocusHeading,
  shouldFetchSuggestions,
  suggestionCanQuickAdd,
  suggestionPixFields,
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

const exactFirst = rankProductSuggestions(
  [
    { id: '1', slug: 'geladeira-frost', name: 'AAA Geladeira Frost' },
    { id: '2', slug: 'geladeira', name: 'Geladeira' },
    { id: '3', slug: 'geladeira-inverter', name: 'Geladeira Inverter' },
  ],
  'geladeira',
  6,
);
assert.equal(exactFirst[0].slug, 'geladeira', 'exact name/slug match ranks first');

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
assert.equal(hasCatalogSuggestionHits(rows), true);

const priced = buildSuggestionRows({
  q: 'tv',
  products: [
    {
      id: '9',
      slug: 'tv-a',
      name: 'TV A',
      price: 100,
      image: 'https://cdn.example/tv-a.jpg',
      category: { name: 'TVs e Áudio', slug: 'eletro' },
    },
  ],
});
const productRow = priced.find((r) => r.kind === 'product');
assert.ok(productRow);
assert.equal(productRow.image, 'https://cdn.example/tv-a.jpg');
assert.equal(productRow.priceLabel, formatSuggestionMoney(100));
assert.ok(productRow.pixLabel && productRow.pixLabel.includes('95'));
assert.ok(productRow.pixLabel.includes('PIX'));
assert.equal(productRow.pixTag, '5% OFF');
assert.equal(productRow.productId, '9');
assert.equal(productRow.canAdd, true);
assert.equal(suggestionCanQuickAdd({ id: '9', stock: 0 }), false);

const soldOut = buildSuggestionRows({
  q: 'tv',
  products: [{ id: '8', slug: 'tv-out', name: 'TV esgotada', price: 80, stock: 0 }],
});
assert.equal(soldOut.find((r) => r.kind === 'product')?.canAdd, false);
assert.equal(formatSuggestionMoney(0), undefined);
assert.equal(formatSuggestionMoney(null), undefined);
assert.equal(suggestionPixFields(100).pixTag, '5% OFF');
assert.equal(productSuggestionImage({ imageUrl: 'https://placehold.co/400' }), undefined);
assert.equal(productSuggestionImage({ image: 'https://cdn.example/ok.jpg' }), 'https://cdn.example/ok.jpg');

const emptyRows = buildSuggestionRows({ q: 'xyzzy', products: [], categories: [] });
assert.equal(hasCatalogSuggestionHits(emptyRows), false);
assert.equal(emptyRows.some((r) => r.kind === 'all'), true);

assert.equal(nextSuggestionIndex(-1, 3, 1), 0);
assert.equal(nextSuggestionIndex(2, 3, 1), -1);
assert.equal(nextSuggestionIndex(-1, 3, -1), 2);
assert.equal(nextSuggestionIndex(0, 0, 1), -1);

assert.ok(suggestionsStatusLabel({ q: 'tv', loading: true, count: 0 }).includes('Buscando'));
assert.ok(suggestionsStatusLabel({ q: 'tv', loading: false, count: 0 }).includes('Nenhuma'));
assert.equal(suggestionsStatusLabel({ q: 'tv', loading: false, count: 2 }), '2 sugestões');
assert.equal(suggestionsStatusLabel({ q: 't', loading: false, count: 2 }), '');

assert.equal(searchFocusHeading(), 'Em alta');
const highlighted = highlightProductsFromShelves(
  {
    shelves: [
      { id: 'offers', title: 'Ofertas', items: [{ id: 'o1', slug: 'oferta', name: 'Oferta real', price: 10 }] },
      { id: 'featured', title: 'Mais vendidos', items: [{ id: 'f1', slug: 'destaque', name: 'Destaque real', price: 20 }] },
      { id: 'newest', title: 'Novidades', items: [{ id: 'n1', slug: 'novo', name: 'Novo real', price: 30 }] },
    ],
  },
  2,
);
assert.deepEqual(
  highlighted.map((p) => p.id),
  ['f1', 'o1'],
);
assert.deepEqual(highlightProductsFromShelves(null), []);
const hiRows = focusHighlightRows(highlighted);
assert.equal(hiRows[0]?.kind, 'product');
assert.equal(hiRows[0]?.href, '/produto/destaque');
assert.ok(hiRows[0]?.pixLabel && hiRows[0].pixLabel.includes('PIX'));
assert.equal(hiRows[0]?.canAdd, true);

const deptShortcuts = focusCategoryShortcuts([
  { id: '1', name: 'Celulares', slug: 'celulares' },
  { id: '2', name: '', slug: 'vazio' },
  { id: '1', name: 'Celulares', slug: 'celulares' },
]);
assert.equal(deptShortcuts.length, 1);
assert.equal(deptShortcuts[0].href, '/departamento/celulares');

const fallback = focusFallbackShortcuts([
  { href: '/departamento/ofertas', label: 'Ofertas' },
  { href: 'https://wa.me/1', label: 'WhatsApp', external: true },
  { href: '/produtos', label: 'Catálogo' },
]);
assert.deepEqual(
  fallback.map((s) => s.href),
  ['/departamento/ofertas', '/produtos'],
);

const box = readFileSync(join(__dirname, '../components/SearchBox.tsx'), 'utf8');
assert.ok(box.includes('search-suggest-thumb'), 'dropdown renders product thumbnail');
assert.ok(box.includes('pixLabel'), 'dropdown renders PIX hint');
assert.ok(
  box.indexOf('search-suggest-pix-lead') < box.indexOf('className="search-suggest-price"'),
  'PIX price leads the suggestion row',
);
assert.ok(box.includes('productCardAddLabel'), 'suggestion add uses the sacola label');
assert.ok(box.includes("api('/cart/items'"), 'suggestion add posts the same cart route');
assert.ok(box.includes('/store/shelves'), 'empty focus reuses live shelves');
assert.ok(box.includes('searchFocusHeading'), 'empty focus has an Em alta heading');
assert.ok(box.includes('focusFallbackShortcuts'), 'empty focus falls back to real routes');
assert.ok(box.includes('catalogSearchHref'), 'submit still goes to /produtos?q=');
assert.ok(box.includes('SEARCH_SUGGEST_DEBOUNCE_MS'), 'debounce kept');
assert.ok(box.includes('nextSuggestionIndex'), 'keyboard a11y kept');
assert.ok(box.includes('searchEmptyCopy'), 'zero-results copy in the dropdown');
assert.ok(box.includes('emptySearchSuggestions'), 'empty shortcuts reuse catalog helpers');
assert.ok(box.includes('/products?q='), 'autocomplete still uses GET /products');

const catalog = readFileSync(join(__dirname, '../app/produtos/page.tsx'), 'utf8');
assert.ok(
  catalog.includes("variant={q ? 'shelf' : 'default'}"),
  'search result cards reuse the PIX-first shelf card',
);

const css = readFileSync(join(__dirname, '../app/globals.css'), 'utf8');
assert.ok(css.includes('search-suggest-pix-lead'), 'PIX price is the lead style');
assert.ok(css.includes('search-suggest-bag'), 'sacola button fits in the dropdown');
assert.ok(css.includes('overflow-x: hidden'), 'search dropdown does not overflow horizontally');
assert.ok(css.includes('100dvh - 168px'), 'mobile dropdown stays above bottom nav');
assert.ok(/\.header\s+\.wrap\s*\{[^}]*overflow:\s*visible/.test(css), 'header wrap does not clip suggestions');

console.log('search-suggestions unit tests ok');
