import assert from 'node:assert/strict';
import {
  activeFilterCount,
  buildFilterChips,
  buyNowLabel,
  cartCheckoutLabel,
  cartTrustItems,
  catalogSearchBackHref,
  catalogSearchQuickChips,
  catalogSortLabel,
  departmentTitle,
  discountPercent,
  emptySearchSuggestions,
  formatPriceRangeChip,
  isCatalogSearchResults,
  isExternalSearchShortcut,
  parseCatalogSort,
  pdpBuyNowHref,
  pixHighlight,
  catalogListEmptyCopy,
  departmentEmptyCopy,
  searchEmptyCopy,
  searchEmptyWhatsAppHref,
  SEARCH_EMPTY_WHATSAPP_TEXT,
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

assert.equal(buyNowLabel({ outOfStock: true, adding: false }), 'Indisponível');
assert.equal(buyNowLabel({ outOfStock: false, adding: true }), 'Adicionando...');
assert.equal(buyNowLabel({ outOfStock: false, adding: false }), 'Comprar agora');
assert.equal(pdpBuyNowHref(), '/carrinho');

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
assert.ok(/whatsapp|catálogo|departamento/i.test(emptyQ.body), 'empty copy points to real shortcuts');

const emptyFilters = searchEmptyCopy('', true);
assert.ok(/filtros/i.test(emptyFilters.title) || /filtros/i.test(emptyFilters.body));

const bareCatalog = catalogListEmptyCopy({ q: '', hasFilters: false });
assert.equal(bareCatalog.kicker, 'Catálogo');
assert.ok(/ainda não tem produtos/i.test(bareCatalog.title));
assert.ok(bareCatalog.whatsappText && bareCatalog.whatsappText.length > 20);
assert.ok(!/r\$\s*\d/i.test(bareCatalog.body));

const sellerEmpty = catalogListEmptyCopy({
  q: '',
  hasFilters: true,
  sellerOnly: true,
  sellerName: 'Rafaela S.M',
});
assert.ok(sellerEmpty.title.includes('Rafaela S.M'));
assert.equal(sellerEmpty.clearFiltersLabel, 'Ver todo o catálogo');

const filteredEmpty = catalogListEmptyCopy({ q: '', hasFilters: true });
assert.equal(filteredEmpty.kicker, 'Filtros');
assert.ok(/filtros/i.test(filteredEmpty.title));

const ofertasEmpty = departmentEmptyCopy({ slug: 'ofertas', title: 'Ofertas', hasFilters: false });
assert.equal(ofertasEmpty.primaryHref, '/#ofertas');
assert.ok(/categoria Ofertas/i.test(ofertasEmpty.body));
assert.ok(/página inicial/i.test(ofertasEmpty.body));
assert.ok(!/r\$\s*\d/.test(ofertasEmpty.body));

const esporteEmpty = departmentEmptyCopy({ slug: 'esporte', title: 'Esporte', hasFilters: false });
assert.equal(esporteEmpty.primaryHref, '/produtos');
assert.ok(esporteEmpty.title.includes('Esporte'));

const filteredDept = departmentEmptyCopy({ slug: 'celulares', title: 'Celulares', hasFilters: true });
assert.equal(filteredDept.primaryHref, '/departamento/celulares');
assert.ok(/filtros/i.test(filteredDept.title));

const zeroHead = searchResultsHeading('', 0);
assert.equal(zeroHead.subtitle, 'Nenhum produto publicado ainda');

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
const sellerChip = buildFilterChips({ seller: 'lojas-schimitz', sellerName: 'Lojas Schimitz' });
assert.ok(sellerChip.some((c) => c.clearKey === 'seller' && c.label === 'Vendido por Lojas Schimitz'));
assert.equal(activeFilterCount({ seller: 'lojas-schimitz' }), 1);

const suggestions = emptySearchSuggestions();
assert.ok(suggestions.length >= 4);
assert.ok(suggestions.every((s) => s.href && s.label));
assert.ok(suggestions.some((s) => s.href === '/produtos'), 'catalog shortcut');
assert.ok(suggestions.some((s) => s.href.startsWith('/departamento/')), 'department shortcuts');
assert.ok(
  suggestions.some((s) => s.external && /wa\.me/.test(s.href) && /whatsapp/i.test(s.label)),
  'WhatsApp shortcut uses real wa.me',
);
assert.ok(SEARCH_EMPTY_WHATSAPP_TEXT.includes('Lojas Schimitz'));
assert.ok(searchEmptyWhatsAppHref('51996253766').includes('wa.me'));
assert.equal(isExternalSearchShortcut({ href: '/produtos' }), false);
assert.equal(isExternalSearchShortcut({ href: 'https://wa.me/x', external: true }), true);

assert.equal(isCatalogSearchResults('tv'), true);
assert.equal(isCatalogSearchResults('  '), false);
assert.equal(isCatalogSearchResults(null), false);
assert.equal(catalogSearchBackHref(), '/');
const quick = catalogSearchQuickChips();
assert.ok(quick.some((c) => /frete/i.test(c.label) && /poa/i.test(c.label)));
assert.ok(quick.some((c) => /pix/i.test(c.label)));
assert.ok(!quick.some((c) => /retire|amanhã|full|samsung|lg/i.test(c.label)));

console.log('storefront-pro unit tests ok');
