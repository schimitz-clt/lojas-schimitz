import assert from 'assert';
import {
  ADMIN_NAV_ITEMS,
  ADMIN_SECTION_IDS,
  DEFAULT_ADMIN_SECTION,
  adminAppRoutePaths,
  adminEntrarHref,
  adminLoginNextPath,
  adminSectionLabel,
  adminSectionPath,
  buildAdminCatalogoPhotosHref,
  buildAdminSectionHref,
  isAdminSectionId,
  isPhotoQueueHash,
  legacyAdminRedirect,
  parseAdminSection,
  photosQueueFromSearch,
  sectionFromPathname,
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

assert.equal(adminSectionPath('ops'), '/admin');
assert.equal(adminSectionPath('pedidos'), '/admin/pedidos');
assert.equal(adminSectionPath('catalogo'), '/admin/catalogo');

assert.equal(sectionFromPathname('/admin'), 'ops');
assert.equal(sectionFromPathname('/admin/'), 'ops');
assert.equal(sectionFromPathname('/admin/ops'), 'ops');
assert.equal(sectionFromPathname('/admin/pedidos'), 'pedidos');
assert.equal(sectionFromPathname('/admin/orders'), 'pedidos');
assert.equal(sectionFromPathname('/admin/clientes'), 'clientes');
assert.equal(sectionFromPathname('/loja'), 'ops');

assert.equal(buildAdminSectionHref('ops'), '/admin');
assert.equal(buildAdminSectionHref('pedidos'), '/admin/pedidos');
assert.equal(
  buildAdminSectionHref('catalogo', { pathname: '/admin/catalogo' }),
  '/admin/catalogo',
);
assert.equal(
  buildAdminSectionHref('ops', { keepParams: { foo: '1' } }),
  '/admin?foo=1',
);
assert.equal(
  buildAdminSectionHref('pedidos', { keepParams: new URLSearchParams('section=ops&x=1') }),
  '/admin/pedidos?x=1',
);
assert.equal(buildAdminCatalogoPhotosHref(), '/admin/catalogo?photos=1');

assert.equal(sectionFromSearch(null), 'ops');
assert.equal(sectionFromSearch(''), 'ops');
assert.equal(sectionFromSearch('?section=pedidos'), 'pedidos');
assert.equal(sectionFromSearch('section=catalogo'), 'catalogo');
assert.equal(sectionFromSearch('?tab=orders'), 'pedidos');
assert.equal(sectionFromSearch('?section=bogus'), 'ops');

assert.equal(photosQueueFromSearch(null), false);
assert.equal(photosQueueFromSearch('?photos=1'), true);
assert.equal(photosQueueFromSearch('fila=fotos'), true);
assert.equal(photosQueueFromSearch('?queue=photos'), true);
assert.equal(photosQueueFromSearch('?photos=0'), false);

assert.equal(isPhotoQueueHash('#admin-photo-queue'), true);
assert.equal(isPhotoQueueHash('photos'), true);
assert.equal(isPhotoQueueHash('#nope'), false);

assert.equal(legacyAdminRedirect({ pathname: '/admin' }), null);
assert.equal(legacyAdminRedirect({ pathname: '/admin/pedidos' }), null);
assert.equal(legacyAdminRedirect({ pathname: '/admin', search: '?section=pedidos' }), '/admin/pedidos');
assert.equal(
  legacyAdminRedirect({ pathname: '/admin', search: '?section=clientes&customer=abc' }),
  '/admin/clientes?customer=abc',
);
assert.equal(
  legacyAdminRedirect({ pathname: '/admin', search: '?section=pedidos&order=oid' }),
  '/admin/pedidos?order=oid',
);
assert.equal(
  legacyAdminRedirect({ pathname: '/admin', search: '?section=catalogo' }),
  '/admin/catalogo',
);
assert.equal(legacyAdminRedirect({ pathname: '/admin', search: '?section=ops' }), '/admin');
assert.equal(legacyAdminRedirect({ pathname: '/admin/ops' }), '/admin');
assert.equal(legacyAdminRedirect({ pathname: '/admin/orders' }), '/admin/pedidos');
assert.equal(
  legacyAdminRedirect({ pathname: '/admin', hash: '#admin-photo-queue' }),
  '/admin/catalogo?photos=1',
);
assert.equal(
  legacyAdminRedirect({ pathname: '/admin', search: '?section=catalogo', hash: '#photos' }),
  '/admin/catalogo?photos=1',
);
assert.equal(
  legacyAdminRedirect({ pathname: '/admin/pedidos', search: '?section=pedidos&order=x' }),
  '/admin/pedidos?order=x',
);
assert.equal(
  legacyAdminRedirect({ pathname: '/admin/catalogo', search: '?photos=1' }),
  null,
);
assert.equal(legacyAdminRedirect({ pathname: '/produtos', search: '?section=pedidos' }), null);

assert.equal(adminLoginNextPath('/admin/pedidos', '?order=1'), '/admin/pedidos?order=1');
assert.equal(adminLoginNextPath('/admin', '?section=vendas'), '/admin/vendas');
assert.equal(adminLoginNextPath('/conta'), '/admin');
assert.equal(adminEntrarHref('/admin/clientes'), '/entrar?next=%2Fadmin%2Fclientes');

const paths = adminAppRoutePaths();
assert.deepEqual(paths, [
  '/admin',
  '/admin/pedidos',
  '/admin/catalogo',
  '/admin/clientes',
  '/admin/vendas',
  '/admin/frete',
  '/admin/cupons',
  '/admin/vitrine',
  '/admin/avaliacoes',
  '/admin/marketplace',
  '/admin/equipe',
]);

console.log('admin-sections web unit ok');
