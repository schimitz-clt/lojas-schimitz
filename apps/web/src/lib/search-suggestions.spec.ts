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
  focusTrendingRows,
  formatSuggestionMoney,
  hasCatalogSuggestionHits,
  highlightProductsFromShelves,
  historyQuerySuggestions,
  nextSuggestionIndex,
  normalizeSearchQuery,
  phraseFromProductName,
  productSuggestHref,
  productSuggestionImage,
  productsFromListResponse,
  queryPhrasesFromProducts,
  rankProductSuggestions,
  searchDepartmentsHeading,
  searchFocusHeading,
  shouldFetchSuggestions,
  shouldOpenSuggestionPanel,
  shouldShowTrendingHeading,
  suggestionCanQuickAdd,
  suggestionLabelParts,
  suggestionPixFields,
  suggestionsStatusLabel,
} from './search-suggestions';

assert.ok(SEARCH_SUGGEST_MIN >= 2);
assert.ok(SEARCH_SUGGEST_DEBOUNCE_MS >= 200);

assert.equal(normalizeSearchQuery('  TêVê  '), 'teve');
assert.equal(shouldFetchSuggestions('t'), false);
assert.equal(shouldFetchSuggestions('tv'), true);
assert.equal(shouldFetchSuggestions('  '), false);
assert.equal(shouldOpenSuggestionPanel({ focused: false }), false);
assert.equal(shouldOpenSuggestionPanel({ focused: true }), true);
assert.equal(shouldOpenSuggestionPanel({ focused: false, open: true }), false);

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

const radioCatalog = [
  { id: '1', slug: 'radio-am-fm', name: 'Rádio AM FM Portátil' },
  { id: '2', slug: 'radio-relogio', name: 'Rádio Relógio Digital' },
  { id: '3', slug: 'tv', name: 'Smart TV 50' },
  { id: '4', slug: 'radio-demo', name: 'Rádio Pioneer Motobras', isDemo: true },
];

function titleTokens(value: string): string[] {
  return normalizeSearchQuery(value).split(/\s+/).filter(Boolean);
}

function isContiguousSlice(title: string, phrase: string): boolean {
  const source = titleTokens(title);
  const slice = titleTokens(phrase);
  if (!slice.length || slice.length > source.length) return false;
  for (let i = 0; i <= source.length - slice.length; i++) {
    if (slice.every((token, j) => source[i + j] === token)) return true;
  }
  return false;
}

const phrases = queryPhrasesFromProducts(radioCatalog, 'radio');
assert.ok(phrases.length >= 2, 'real titles become query phrases');
assert.ok(phrases.some((p) => normalizeSearchQuery(p).includes('am fm')));
assert.ok(phrases.some((p) => normalizeSearchQuery(p).includes('relogio')));
assert.ok(!phrases.some((p) => /pioneer|motobras/.test(normalizeSearchQuery(p))), 'demo titles are not suggestions');
for (const phrase of phrases) {
  const source = radioCatalog.find(
    (p) => !p.isDemo && isContiguousSlice(p.name, phrase),
  );
  assert.ok(source, `phrase must be a contiguous slice of a real title: ${phrase}`);
}
assert.equal(phraseFromProductName('Smart TV 50', 'tv'), 'TV 50');
assert.deepEqual(queryPhrasesFromProducts(radioCatalog, 'xy'), []);

const rows = buildSuggestionRows({
  q: 'tv',
  products: ranked,
  categories: [
    { id: '2', name: 'TVs e Áudio', slug: 'eletro' },
    { id: '1', name: 'Celulares', slug: 'celulares' },
  ],
  history: ['tv 50', 'geladeira frost'],
});
assert.equal(rows[0].kind, 'category');
assert.equal(rows[0].href, '/departamento/eletro');
assert.ok(rows.some((r) => r.kind === 'query' && r.href.startsWith('/produtos?q=')));
assert.ok(!rows.some((r) => r.kind === 'product'), 'typing does not open product cards');
assert.ok(!rows.some((r) => r.kind === 'all'));
assert.ok(rows.every((r) => !r.canAdd && !r.priceLabel && !r.pixLabel));
assert.ok(rows.every((r) => /^[a-z0-9-]+$/i.test(r.id)), 'suggestion ids stay selector-safe');
assert.ok(!rows.some((r) => /celulares/i.test(r.label)), 'unrelated departments stay out');
assert.equal(hasCatalogSuggestionHits(rows), true);
assert.deepEqual(historyQuerySuggestions(['Rádio AM', 'Fone'], 'radio'), ['Rádio AM']);

const parts = suggestionLabelParts('Rádio AM FM', 'radio');
assert.equal(normalizeSearchQuery(parts.match), 'radio');
assert.ok(parts.after.toLowerCase().includes('am'));

assert.equal(formatSuggestionMoney(0), undefined);
assert.equal(formatSuggestionMoney(null), undefined);
assert.equal(suggestionPixFields(100).pixTag, '5% OFF');
assert.equal(suggestionCanQuickAdd({ id: '9', stock: 0 }), false);
assert.equal(productSuggestionImage({ imageUrl: 'https://placehold.co/400' }), undefined);
assert.equal(productSuggestionImage({ image: 'https://cdn.example/ok.jpg' }), 'https://cdn.example/ok.jpg');

const emptyRows = buildSuggestionRows({ q: 'xyzzy', products: [], categories: [] });
assert.equal(hasCatalogSuggestionHits(emptyRows), false);
assert.equal(emptyRows.length, 0);

assert.equal(nextSuggestionIndex(-1, 3, 1), 0);
assert.equal(nextSuggestionIndex(2, 3, 1), -1);
assert.equal(nextSuggestionIndex(-1, 3, -1), 2);
assert.equal(nextSuggestionIndex(0, 0, 1), -1);

assert.ok(suggestionsStatusLabel({ q: 'tv', loading: true, count: 0 }).includes('Buscando'));
assert.ok(suggestionsStatusLabel({ q: 'tv', loading: false, count: 0 }).includes('Nenhuma'));
assert.equal(suggestionsStatusLabel({ q: 'tv', loading: false, count: 2 }), '2 sugestões');
assert.equal(suggestionsStatusLabel({ q: 't', loading: false, count: 2 }), '');

assert.equal(searchFocusHeading(), 'Em alta');
assert.equal(searchDepartmentsHeading(), 'Departamentos');
assert.equal(shouldShowTrendingHeading(0), false);
assert.equal(shouldShowTrendingHeading(2), true);
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
const trending = focusTrendingRows(highlighted);
assert.equal(trending[0]?.href, '/produto/destaque');
assert.equal(trending[0]?.label, 'Destaque real');
assert.equal(trending[0]?.canAdd, undefined);
assert.equal(trending[0]?.priceLabel, undefined);
assert.equal(trending[0]?.pixLabel, undefined);
const withDemo = highlightProductsFromShelves({
  shelves: [
    {
      id: 'featured',
      title: 'Mais vendidos',
      items: [
        { id: 'd1', slug: 'demo-sku', name: 'Demo inventado', isDemo: true },
        { id: 'r1', slug: 'real-sku', name: 'Produto real' },
      ],
    },
  ],
});
assert.deepEqual(withDemo.map((p) => p.id), ['r1']);

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
assert.ok(box.includes('search-suggest-chevron'), 'suggestion row ends in a chevron');
assert.ok(box.includes('suggestionLabelParts'), 'completion is emphasized from the real label');
assert.equal(box.includes('search-suggest-bag'), false, 'no sacola button in the overlay');
assert.equal(box.includes('productCardAddLabel'), false, 'add-to-bag stays off the suggestion list');
assert.equal(box.includes("api('/cart/items'"), false, 'overlay does not post to the cart');
assert.equal(box.includes('focusFallbackShortcuts'), false, 'empty focus does not invent shortcut labels');
assert.equal(box.includes('emptySearchSuggestions'), false, 'overlay does not use a hardcoded suggestion list');
assert.ok(box.includes('/store/shelves'), 'empty focus reuses live shelves');
assert.ok(box.includes('searchFocusHeading'), 'empty focus has an Em alta heading');
assert.ok(box.includes('shouldShowTrendingHeading'), 'Em alta only when the shelf has items');
assert.ok(box.includes('catalogSearchHref'), 'submit still goes to /produtos?q=');
assert.ok(box.includes('SEARCH_SUGGEST_DEBOUNCE_MS'), 'debounce kept');
assert.ok(box.includes('nextSuggestionIndex'), 'keyboard a11y kept');
assert.ok(box.includes('searchEmptyCopy'), 'zero-results copy in the dropdown');
assert.ok(box.includes('/products?q='), 'autocomplete still uses GET /products');
assert.ok(box.includes('shouldOpenSuggestionPanel'), 'overlay stays closed on results until focus');
assert.ok(box.includes('closeSuggestions'), 'submit closes the suggest panel');
assert.ok(box.includes('setFocused(false)'), 'URL seed clears focus so results stay clean');
assert.ok(box.includes('SEARCH_OPEN_CLASS'), 'open panel pins the chrome');

const catalog = readFileSync(join(__dirname, '../app/produtos/page.tsx'), 'utf8');
assert.ok(
  catalog.includes("variant={q ? 'shelf' : 'default'}"),
  'search result cards reuse the PIX-first shelf card',
);
assert.ok(catalog.includes('sf-filter-options'), 'Magalu-like filter option chips');
assert.ok(catalog.includes('catalogSearchQuickChips'), 'quick chips use real store facts');
assert.ok(catalog.includes('Categoria'), 'categoria chip stays API-backed');
assert.ok(catalog.includes('Preço'), 'preço chip stays API-backed');
assert.ok(!/Retire Grátis|Receba até Amanhã|Full\b|Patrocinado/i.test(catalog), 'no invented Magalu marketplace cues');

const header = readFileSync(join(__dirname, '../components/Header.tsx'), 'utf8');
assert.ok(header.includes('hdr-search-back'), 'search results show a back control');
assert.ok(header.includes('isCatalogSearchResults'), 'back only on /produtos?q=');
assert.ok(header.includes('catalogSearchBackHref'), 'back uses the shared home href');

const css = readFileSync(join(__dirname, '../app/globals.css'), 'utf8');
assert.equal(css.includes('search-suggest-bag'), false, 'sacola styles left the dropdown');
assert.ok(css.includes('search-suggest-chevron'), 'chevron styled in Schimitz chrome');
assert.ok(css.includes('search-suggest-emph'), 'completion emphasis stays black/yellow, not a second brand');
assert.ok(css.includes('overflow-x: hidden'), 'search dropdown does not overflow horizontally');
assert.ok(css.includes('100dvh - 168px'), 'mobile dropdown stays above bottom nav');
assert.ok(/\.header\s+\.wrap\s*\{[^}]*overflow:\s*visible/.test(css), 'header wrap does not clip suggestions');
assert.ok(css.includes('.hdr-search-back'), 'back control styled in Schimitz chrome');
assert.ok(css.includes('var(--yellow-soft)'), 'active suggestion uses the Schimitz yellow wash');

const theme = readFileSync(join(__dirname, '../components/storefront/storefront-theme.css'), 'utf8');
assert.ok(theme.includes('.sf-filter-options'), 'filter option rail styled');
assert.ok(theme.includes('.sf-filter-quick'), 'quick chip row styled');

console.log('search-suggestions unit tests ok');
