import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  FAVORITES_MAX_BADGE,
  WISHLIST_PATH,
  favoriteProductIds,
  formatWishlistBadge,
  isWishlistOutOfStock,
  isWishlistPath,
  parseFavoriteList,
  wishlistAddToCartLabel,
  wishlistAddToast,
  wishlistAlreadyToast,
  wishlistEmptyCopy,
  wishlistErrorMessage,
  wishlistGuestBanner,
  wishlistGuestSavedToast,
  wishlistHeading,
  wishlistLoginHref,
  wishlistNeedLoginToast,
  wishlistPixLabel,
  wishlistPriceLabel,
  wishlistProductHref,
  wishlistRemoveLabel,
  wishlistRemoveToast,
  wishlistToggleLabel,
} from './wishlist-ui';

const guest = wishlistEmptyCopy(false);
assert.ok(guest.title.toLowerCase().includes('entre'));
assert.ok(guest.ctaHref.includes('/entrar?next='));
assert.ok(guest.ctaHref.includes(encodeURIComponent(WISHLIST_PATH)));
assert.equal(guest.ctaLabel, 'Entrar');

const empty = wishlistEmptyCopy(true);
assert.ok(empty.title.toLowerCase().includes('nenhum'));
assert.equal(empty.ctaHref, '/produtos');

assert.equal(wishlistHeading(0, false).title, 'Salvos');
assert.ok(wishlistHeading(0, true).subtitle.toLowerCase().includes('nenhum'));
assert.equal(wishlistHeading(1, true).subtitle, '1 produto salvo');
assert.equal(wishlistHeading(3, true).subtitle, '3 produtos salvos');
assert.ok(wishlistHeading(2, false).subtitle.includes('aparelho'));

assert.equal(formatWishlistBadge(0), null);
assert.equal(formatWishlistBadge(-2), null);
assert.equal(formatWishlistBadge(4), '4');
assert.equal(formatWishlistBadge(FAVORITES_MAX_BADGE + 5), `${FAVORITES_MAX_BADGE}+`);

assert.ok(wishlistAddToast().toLowerCase().includes('salvo'));
assert.ok(wishlistRemoveToast().includes('Removido'));
assert.ok(wishlistNeedLoginToast().toLowerCase().includes('entre'));
assert.ok(wishlistGuestSavedToast().toLowerCase().includes('aparelho'));
assert.ok(wishlistAlreadyToast().includes('já'));
assert.equal(wishlistRemoveLabel(), 'Remover');
assert.equal(wishlistToggleLabel(false), 'Salvar');
assert.equal(wishlistToggleLabel(true), 'Salvo');

assert.equal(wishlistAddToCartLabel({ outOfStock: true, adding: false, added: false }), 'Indisponível');
assert.equal(wishlistAddToCartLabel({ outOfStock: false, adding: true, added: false }), 'Adicionando…');
assert.equal(wishlistAddToCartLabel({ outOfStock: false, adding: false, added: true }), '✓ Na sacola');
assert.ok(wishlistAddToCartLabel({ outOfStock: false, adding: false, added: false }).includes('sacola'));

assert.equal(wishlistErrorMessage(new Error('Token inválido'), 'add'), wishlistNeedLoginToast());
assert.equal(
  wishlistErrorMessage(new Error('Produto já está nos favoritos'), 'add'),
  wishlistAlreadyToast(),
);
assert.ok(wishlistErrorMessage(new Error('Favorito não encontrado'), 'remove').includes('já não'));

const parsed = parseFavoriteList([
  {
    id: 'f1',
    productId: 'p1',
    product: { id: 'p1', slug: 'tv-a', name: 'TV A', price: 1000, stock: 4 },
  },
  { id: 'f1-dup', productId: 'p1', product: { id: 'p1', slug: 'tv-a', name: 'TV A' } },
  { foo: 1 },
  { id: 'f2', productId: 'p2', product: { id: 'p2', slug: 'tv-b', name: 'TV B', inventory: { qtyOnHand: 0, qtyReserved: 0 } } },
]);
assert.equal(parsed.length, 2);
assert.deepEqual(favoriteProductIds(parsed), ['p1', 'p2']);
assert.equal(isWishlistOutOfStock(parsed[0].product), false);
assert.equal(isWishlistOutOfStock(parsed[1].product), true);
assert.equal(isWishlistOutOfStock({ id: 'x', slug: 'x', name: 'X' }), false);

assert.equal(wishlistProductHref(parsed[0].product), '/produto/tv-a');
assert.ok(wishlistPriceLabel(parsed[0].product).includes('1.000'));
assert.ok(wishlistPixLabel(parsed[0].product)?.includes('PIX'));
assert.equal(wishlistLoginHref(), `/entrar?next=${encodeURIComponent(WISHLIST_PATH)}`);
assert.equal(wishlistGuestBanner().ctaHref, wishlistLoginHref());
assert.equal(isWishlistPath('/conta/salvos'), true);
assert.equal(isWishlistPath('/favoritos'), true);
assert.equal(isWishlistPath('/conta'), false);

const srcRoot = join(__dirname, '..');
const card = readFileSync(join(srcRoot, 'components/ProductCard.tsx'), 'utf8');
assert.ok(card.includes('FavoriteToggle'), 'ProductCard shows heart');
assert.ok(card.includes('product={p}'), 'heart receives live product for guest snapshot');

const pdp = readFileSync(join(srcRoot, 'app/produto/[slug]/ProductClient.tsx'), 'utf8');
assert.ok(pdp.includes('FavoriteToggle'), 'PDP has heart');
assert.ok(pdp.includes('product={p}'), 'PDP heart receives product');

const menu = readFileSync(join(srcRoot, 'lib/account-menu.ts'), 'utf8');
assert.ok(menu.includes("label: 'Salvos'"), 'Conta menu says Salvos');
assert.ok(menu.includes("href: ACCOUNT_SALVOS_PATH") || menu.includes("href: '/conta/salvos'"), 'Conta Salvos opens the page');

console.log('wishlist-ui unit tests ok');
