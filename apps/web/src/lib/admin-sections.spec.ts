import assert from 'assert';
import {
  ADMIN_NAV_ITEMS,
  ADMIN_SECTION_IDS,
  DEFAULT_ADMIN_SECTION,
  adminSectionLabel,
  buildAdminSectionHref,
  isAdminSectionId,
  parseAdminSection,
  sectionFromSearch,
} from './admin-sections';

assert.equal(DEFAULT_ADMIN_SECTION, 'ops');
assert.ok(ADMIN_SECTION_IDS.includes('ops'));
assert.ok(ADMIN_SECTION_IDS.includes('pedidos'));
assert.ok(ADMIN_SECTION_IDS.includes('catalogo'));
assert.equal(ADMIN_NAV_ITEMS[0]?.id, 'ops');

assert.equal(parseAdminSection(null), 'ops');
assert.equal(parseAdminSection(undefined), 'ops');
assert.equal(parseAdminSection(''), 'ops');
assert.equal(parseAdminSection('OPS'), 'ops');
assert.equal(parseAdminSection('pedidos'), 'pedidos');
assert.equal(parseAdminSection('orders'), 'pedidos');
assert.equal(parseAdminSection('catalogo'), 'catalogo');
assert.equal(parseAdminSection('products'), 'catalogo');
assert.equal(parseAdminSection('nope'), 'ops');
assert.equal(parseAdminSection('reconciliations'), 'ops');

assert.equal(isAdminSectionId('ops'), true);
assert.equal(isAdminSectionId('pedidos'), true);
assert.equal(isAdminSectionId('x'), false);
assert.equal(isAdminSectionId(1), false);

assert.equal(adminSectionLabel('pedidos'), 'Pedidos');
assert.equal(adminSectionLabel('ops'), 'Ops');

assert.equal(buildAdminSectionHref('ops'), '/admin');
assert.equal(buildAdminSectionHref('pedidos'), '/admin?section=pedidos');
assert.equal(
  buildAdminSectionHref('catalogo', { pathname: '/admin' }),
  '/admin?section=catalogo',
);
assert.equal(
  buildAdminSectionHref('ops', { keepParams: { foo: '1' } }),
  '/admin?foo=1',
);
assert.equal(
  buildAdminSectionHref('pedidos', { keepParams: new URLSearchParams('section=ops&x=1') }),
  '/admin?x=1&section=pedidos',
);

assert.equal(sectionFromSearch(null), 'ops');
assert.equal(sectionFromSearch(''), 'ops');
assert.equal(sectionFromSearch('?section=pedidos'), 'pedidos');
assert.equal(sectionFromSearch('section=catalogo'), 'catalogo');
assert.equal(sectionFromSearch('?tab=orders'), 'pedidos');
assert.equal(sectionFromSearch('?section=bogus'), 'ops');

console.log('admin-sections web unit ok');
