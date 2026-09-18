import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ACCOUNT_EDIT_ADDRESS_CTA,
  ACCOUNT_DADOS_PATH,
  ACCOUNT_HUB_TITLE,
  ACCOUNT_VISTOS_PATH,
  ACCOUNT_WHATSAPP_HELP_TEXT,
  accountAddressFormFrom,
  accountAddressFormOpen,
  accountAddressSaveRequest,
  accountAddressToEdit,
  emptyAccountAddressForm,
  accountFirstName,
  accountGreeting,
  accountLoginHref,
  accountMenuSections,
  accountWhatsAppHref,
  recentVistosEmptyCopy,
} from './account-menu';

assert.equal(ACCOUNT_HUB_TITLE, 'Sua conta');
assert.equal(ACCOUNT_DADOS_PATH, '/conta/dados');
assert.equal(ACCOUNT_VISTOS_PATH, '/conta/vistos');
assert.ok(ACCOUNT_WHATSAPP_HELP_TEXT.includes('Lojas Schimitz'));
assert.ok(!/magalu/i.test(ACCOUNT_WHATSAPP_HELP_TEXT));

assert.equal(accountFirstName(null), '');
assert.equal(accountFirstName({ name: 'Claiton Schimitz', email: 'c@x.com' }), 'Claiton');
assert.equal(accountFirstName({ name: 'Admin Loja', email: 'a@x.com' }), 'Loja');
assert.equal(accountFirstName({ name: '', email: 'ana@loja.com' }), 'ana');

const guestGreet = accountGreeting(null);
assert.equal(guestGreet.title, 'Olá');
assert.ok(guestGreet.subtitle.toLowerCase().includes('entre'));

const inGreet = accountGreeting({ name: 'Maria Silva', email: 'maria@loja.com' });
assert.equal(inGreet.title, 'Olá, Maria');
assert.equal(inGreet.subtitle, 'maria@loja.com');

assert.equal(accountLoginHref('/conta/dados'), '/entrar?next=%2Fconta%2Fdados');
assert.equal(accountLoginHref('/pedidos'), '/entrar?next=%2Fpedidos');

const wa = accountWhatsAppHref(ACCOUNT_WHATSAPP_HELP_TEXT, '51996253766');
assert.ok(wa.startsWith('https://wa.me/5551996253766?text='));
assert.ok(wa.includes(encodeURIComponent('Lojas Schimitz')));

const guest = accountMenuSections({
  loggedIn: false,
  whatsappHref: wa,
});
assert.deepEqual(
  guest.map((s) => s.id),
  ['pedidos', 'conta', 'ajuda'],
);
assert.ok(guest.every((s) => s.title && s.items.length > 0));
assert.ok(!guest.flatMap((s) => s.items).some((i) => i.action === 'logout'));
assert.equal(guest[0].items.find((i) => i.id === 'orders')?.href, accountLoginHref('/pedidos'));
assert.equal(guest[0].items.find((i) => i.id === 'recent')?.href, ACCOUNT_VISTOS_PATH);
assert.equal(guest[1].items.find((i) => i.id === 'profile')?.href, accountLoginHref(ACCOUNT_DADOS_PATH));
assert.equal(guest[1].items.find((i) => i.id === 'favorites')?.href, '/favoritos');
assert.equal(guest[2].items.find((i) => i.id === 'whatsapp')?.href, wa);
assert.equal(guest[2].items.find((i) => i.id === 'whatsapp')?.external, true);
assert.equal(guest[2].items.find((i) => i.id === 'support')?.href, '/suporte');
function assertCustomerOnlyMenu(sections: ReturnType<typeof accountMenuSections>) {
  const items = sections.flatMap((s) => s.items);
  assert.ok(!items.some((i) => i.id === 'admin' || i.id === 'seller'));
  assert.ok(!items.some((i) => i.href === '/admin' || i.href === '/vendedor'));
  assert.ok(!items.some((i) => /admin da loja|portal do vendedor/i.test(i.label)));
}

assertCustomerOnlyMenu(guest);

const member = accountMenuSections({
  loggedIn: true,
  role: 'customer',
  whatsappHref: wa,
});
assert.equal(member[0].items.find((i) => i.id === 'orders')?.href, '/pedidos');
assert.equal(member[1].items.find((i) => i.id === 'profile')?.href, ACCOUNT_DADOS_PATH);
assert.equal(member[1].items.find((i) => i.id === 'logout')?.action, 'logout');
assertCustomerOnlyMenu(member);

const admin = accountMenuSections({
  loggedIn: true,
  role: 'admin',
  whatsappHref: wa,
});
assert.equal(admin[1].items.find((i) => i.id === 'logout')?.action, 'logout');
assertCustomerOnlyMenu(admin);

const seller = accountMenuSections({
  loggedIn: true,
  role: 'seller',
  whatsappHref: wa,
});
assertCustomerOnlyMenu(seller);

assert.equal(ACCOUNT_EDIT_ADDRESS_CTA, 'Alterar endereço');
assert.ok(!ACCOUNT_EDIT_ADDRESS_CTA.toLowerCase().includes('adicionar outro'));
assert.equal(
  accountAddressFormOpen({ loaded: false, addressCount: 0, userRequestedEdit: false }),
  false,
  'hide blank form while addresses are still loading',
);
assert.equal(
  accountAddressFormOpen({ loaded: true, addressCount: 0, userRequestedEdit: false }),
  true,
  'first cadastro shows the form',
);
assert.equal(
  accountAddressFormOpen({ loaded: true, addressCount: 1, userRequestedEdit: false }),
  false,
  'saved address hides the blank form',
);
assert.equal(
  accountAddressFormOpen({ loaded: true, addressCount: 2, userRequestedEdit: true }),
  true,
  'Alterar endereço reveals the form',
);

assert.equal(accountAddressToEdit([]), null);
assert.equal(
  accountAddressToEdit([
    { id: 'a', isDefault: false },
    { id: 'b', isDefault: true },
  ])?.id,
  'b',
);
assert.equal(accountAddressToEdit([{ id: 'only' }])?.id, 'only');

const prefilled = accountAddressFormFrom({
  id: 'addr-1',
  label: 'Casa',
  street: 'Rua Jacy Costa',
  number: '19',
  district: 'Porto Alegre',
  city: 'Porto Alegre',
  uf: 'rs',
  cep: '91160390',
  isDefault: true,
});
assert.equal(prefilled.street, 'Rua Jacy Costa');
assert.equal(prefilled.number, '19');
assert.equal(prefilled.cep, '91160390');
assert.equal(prefilled.uf, 'RS');
assert.deepEqual(emptyAccountAddressForm().cep, '');

assert.deepEqual(accountAddressSaveRequest(null), { path: '/me/addresses', method: 'POST' });
assert.deepEqual(accountAddressSaveRequest('addr-1'), {
  path: '/me/addresses/addr-1',
  method: 'PATCH',
});

const empty = recentVistosEmptyCopy();
assert.equal(empty.ctaHref, '/produtos');
assert.ok(empty.title.includes('visto'));

const srcRoot = join(__dirname, '..');
const hub = readFileSync(join(srcRoot, 'app/conta/page.tsx'), 'utf8');
assert.ok(hub.includes('AccountMenu'), 'hub renders sectioned menu');
assert.ok(hub.includes('clearSession()'), 'hub logout still uses clearSession');
assert.ok(hub.includes("api") && hub.includes('/orders'), 'hub loads real /orders');
assert.ok(hub.includes('pickInProgressOrder'), 'in-progress card stays on hub');
assert.ok(!hub.includes("window.location.href = '/entrar'"), 'logged-out hub is not a blank redirect');
assert.ok(hub.includes('Entrar'), 'guest CTA');
assert.ok(!/magalu/i.test(hub), 'no Magalu copy on hub');
assert.ok(!/MagaluPay/i.test(hub), 'no MagaluPay');

const dados = readFileSync(join(srcRoot, 'app/conta/dados/page.tsx'), 'utf8');
assert.ok(dados.includes("api<Address[]>('/me/addresses')"), 'dados keeps addresses API');
assert.ok(dados.includes("api<Loyalty>('/me/loyalty')"), 'dados keeps loyalty API');
assert.ok(dados.includes("api('/me'"), 'dados keeps phone PATCH');
assert.ok(dados.includes('accountAddressFormOpen'), 'dados uses address form visibility helper');
assert.ok(dados.includes('ACCOUNT_EDIT_ADDRESS_CTA'), 'dados uses Alterar endereço CTA');
assert.ok(dados.includes('accountAddressToEdit'), 'dados picks default/first address to edit');
assert.ok(dados.includes('accountAddressFormFrom'), 'dados prefills the existing address');
assert.ok(dados.includes('accountAddressSaveRequest'), 'dados uses real POST/PATCH path');
assert.ok(dados.includes("setEditAddressOpen(false)"), 'saving an address hides the form again');
assert.ok(!/adicionar outro/i.test(dados), 'no Adicionar outro copy');
assert.ok(dados.includes('SCHIMITZ+'), 'loyalty brand stays Schimitz');
assert.ok(!/magalu/i.test(dados), 'no Magalu on dados');

const vistos = readFileSync(join(srcRoot, 'app/conta/vistos/page.tsx'), 'utf8');
assert.ok(vistos.includes('readRecentList'), 'vistos uses existing recently-viewed');
assert.ok(vistos.includes('ProductCard'), 'vistos shows real catalog snapshots');

const menuSrc = readFileSync(join(srcRoot, 'lib/account-menu.ts'), 'utf8');
assert.ok(!menuSrc.includes("label: 'Admin da loja'"), 'Conta hub source has no Admin da loja row');
assert.ok(!menuSrc.includes("label: 'Portal do vendedor'"), 'Conta hub source has no Portal do vendedor row');
assert.ok(!menuSrc.includes("href: '/admin'"), 'Conta hub does not link /admin');
assert.ok(!menuSrc.includes("href: '/vendedor'"), 'Conta hub does not link /vendedor');

const menuUi = readFileSync(join(srcRoot, 'components/account/AccountMenu.tsx'), 'utf8');
assert.ok(menuUi.includes('account-hub-row'), 'row layout');
assert.ok(menuUi.includes('account-hub-chevron'), 'chevron');
assert.ok(!/magalu/i.test(menuUi), 'component has no Magalu trademark');

const nav = readFileSync(join(srcRoot, 'components/BottomNav.tsx'), 'utf8');
assert.ok(/contaHref = '\/conta'/.test(nav), 'Conta tab always opens /conta hub');
assert.ok(!nav.includes("user ? '/conta' : '/entrar'"), 'logged-out Conta is not /entrar');
assert.ok(/label: 'Conta'/.test(nav), 'Conta tab label stays');

const header = readFileSync(join(srcRoot, 'components/Header.tsx'), 'utf8');
assert.ok(header.includes('hdr-hide-sm'), 'do not re-add account name to mobile header');

const css = readFileSync(join(srcRoot, 'components/storefront/storefront-theme.css'), 'utf8');
assert.ok(css.includes('.account-hub'), 'hub styles live on storefront tokens');
assert.ok(css.includes('max-width: 560px'), 'readable desktop width');
assert.ok(css.includes('.account-dados-edit-address'), 'edit-address CTA uses account-dados tokens');

console.log('account-menu unit + source tests ok');
