import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  ADMIN_NAV_GROUPS,
  ADMIN_NAV_ITEMS,
  ADMIN_SECTION_IDS,
  adminNavGroupFor,
  DEFAULT_ADMIN_SECTION,
  adminAppRoutePaths,
  adminEntrarHref,
  ADMIN_LOGOUT_LABEL,
  adminLoginNextPath,
  adminLogoutHref,
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
assert.ok(ADMIN_SECTION_IDS.includes('equipe'));
assert.ok(ADMIN_SECTION_IDS.includes('notificacoes'));
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
assert.equal(parseAdminSection('equipe'), 'equipe');
assert.equal(parseAdminSection('notificacoes'), 'notificacoes');
assert.equal(parseAdminSection('push'), 'notificacoes');
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
assert.equal(sectionFromPathname('/admin/equipe'), 'equipe');
assert.equal(sectionFromPathname('/admin/notificacoes'), 'notificacoes');
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
assert.equal(parseAdminSection('estoque'), 'catalogo');
assert.equal(legacyAdminRedirect({ pathname: '/admin/estoque' }), '/admin/catalogo');
assert.equal(legacyAdminRedirect({ pathname: '/admin', search: '?section=estoque' }), '/admin/catalogo');

const groupedIds = ADMIN_NAV_GROUPS.flatMap((group) => [...group.itemIds]);
assert.equal(groupedIds.length, ADMIN_SECTION_IDS.length);
assert.deepEqual([...groupedIds].sort(), [...ADMIN_SECTION_IDS].sort());
assert.equal(adminNavGroupFor('ops').label, 'Operação');
assert.equal(adminNavGroupFor('pedidos').label, 'Operação');
assert.equal(adminNavGroupFor('notificacoes').label, 'Operação');
assert.equal(adminNavGroupFor('catalogo').label, 'Catálogo');
assert.equal(adminNavGroupFor('clientes').label, 'Loja');
assert.equal(adminNavGroupFor('vendas').label, 'Loja');
assert.equal(adminNavGroupFor('frete').label, 'Loja');
assert.equal(adminNavGroupFor('cupons').label, 'Loja');
assert.equal(adminNavGroupFor('vitrine').label, 'Loja');
assert.equal(adminNavGroupFor('avaliacoes').label, 'Loja');
assert.equal(adminNavGroupFor('marketplace').label, 'Crescimento');
assert.equal(adminNavGroupFor('equipe').label, 'Sistema');
const catalogGroup = ADMIN_NAV_GROUPS.find((group) => group.id === 'catalogo');
assert.equal(catalogGroup?.aliasTip?.label, 'Estoque');
assert.equal(catalogGroup?.aliasTip?.target, 'catalogo');
assert.equal(catalogGroup?.itemIds.length, 1);

assert.equal(adminLoginNextPath('/admin/pedidos', '?order=1'), '/admin/pedidos?order=1');
assert.equal(adminLoginNextPath('/admin', '?section=vendas'), '/admin/vendas');
assert.equal(adminLoginNextPath('/conta'), '/admin');
assert.equal(adminEntrarHref('/admin/clientes'), '/entrar?next=%2Fadmin%2Fclientes');
assert.equal(ADMIN_LOGOUT_LABEL, 'Sair');
assert.equal(adminLogoutHref(), '/entrar?next=%2Fadmin');
assert.equal(adminLogoutHref(), adminEntrarHref('/admin'));

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
  '/admin/notificacoes',
]);

const consoleSrc = readFileSync(join(__dirname, '../components/admin/AdminConsole.tsx'), 'utf8');
assert.ok(consoleSrc.includes('notificacoes: AdminNotificacoesSection'), 'Admin console wires Notificações');
assert.ok(consoleSrc.includes('headerActions={<AdminLogoutButton />}'), 'AdminConsole wires headerActions');
assert.ok(consoleSrc.includes('clearSession()'), 'Admin Sair reuses Conta clearSession');
assert.ok(consoleSrc.includes('adminLogoutHref()'), 'Admin Sair redirects via adminLogoutHref');
assert.ok(consoleSrc.includes('admin-header__logout'), 'Admin Sair uses header ghost class');
assert.ok(consoleSrc.includes('{ADMIN_LOGOUT_LABEL}'), 'Admin Sair label is Sair');

const shellSrc = readFileSync(join(__dirname, '../components/admin/AdminShell.tsx'), 'utf8');
assert.ok(shellSrc.includes('{headerActions}'), 'AdminShell renders headerActions slot');
assert.ok(shellSrc.includes('ADMIN_NAV_GROUPS'), 'sidebar renders grouped nav');
assert.ok(shellSrc.includes('{navGroup.label}'), 'sidebar prints group labels');
assert.ok(shellSrc.includes('admin-nav-alias'), 'Estoque alias is a tip, not a route');
assert.ok(shellSrc.includes('{tip.label}'), 'alias tip uses the group label, not a new path');
assert.ok(shellSrc.includes('admin-mobile-nav'), 'mobile nav pattern stays');

const opsSectionSrc = readFileSync(
  join(__dirname, '../components/admin/sections/AdminOpsSection.tsx'),
  'utf8',
);
assert.ok(opsSectionSrc.includes('variant="command"'), 'Ops home uses the attention question');
assert.ok(opsSectionSrc.includes('selectOpsAlert'), 'Ops alerts keep existing deep-link');
assert.ok(opsSectionSrc.includes('OPS_NOW_HEADING'), 'Ops answers what is happening now');
assert.ok(opsSectionSrc.includes('OPS_DO_HEADING'), 'Ops answers what can be done now');
assert.ok(opsSectionSrc.includes('OPS_QUICK_ACTIONS'), 'Ops quick actions are the existing navigation set');

const stateSrc = readFileSync(join(__dirname, '../components/admin/admin-console-state.ts'), 'utf8');
assert.ok(stateSrc.includes('if (!u)'), 'logged-out /admin hits guest gate');
assert.ok(stateSrc.includes('adminEntrarHref('), 'guest gate uses existing Entrar login');
assert.ok(stateSrc.includes("u.role !== 'admin'"), 'non-admin keeps in-shell restriction');
assert.ok(stateSrc.includes('opsAlertDestination'), 'alert clicks use the existing destination map');

const themeSrc = readFileSync(join(__dirname, '../components/admin/admin-theme.css'), 'utf8');
assert.ok(themeSrc.includes('.admin-header__logout'), 'logout button styled in admin theme');
assert.ok(themeSrc.includes('.admin-nav-item:focus-visible'), 'nav focus state is visible');
assert.ok(themeSrc.includes('min-height: 48px'), 'shell keeps 48px touch targets');
assert.ok(themeSrc.includes('.admin-attn--command'), 'Ops attention uses the command surface');

const contaSrc = readFileSync(join(__dirname, '../app/conta/page.tsx'), 'utf8');
assert.ok(contaSrc.includes('clearSession()'), 'Conta logout still uses clearSession');

console.log('admin-sections web unit ok');
