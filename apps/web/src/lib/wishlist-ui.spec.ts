import assert from 'node:assert/strict';
import {
  FAVORITES_MAX_BADGE,
  favoriteProductIds,
  formatWishlistBadge,
  isWishlistOutOfStock,
  parseFavoriteList,
  wishlistAddToCartLabel,
  wishlistAddToast,
  wishlistAlreadyToast,
  wishlistEmptyCopy,
  wishlistErrorMessage,
  wishlistHeading,
  wishlistNeedLoginToast,
  wishlistRemoveLabel,
  wishlistRemoveToast,
  wishlistToggleLabel,
} from './wishlist-ui';

const guest = wishlistEmptyCopy(false);
assert.ok(guest.title.toLowerCase().includes('entre'));
assert.equal(guest.ctaHref, '/entrar?next=/favoritos');
assert.equal(guest.ctaLabel, 'Entrar');

const empty = wishlistEmptyCopy(true);
assert.ok(empty.title.toLowerCase().includes('nenhum'));
assert.equal(empty.ctaHref, '/produtos');

assert.equal(wishlistHeading(0, false).title, 'Favoritos');
assert.ok(wishlistHeading(0, true).subtitle.toLowerCase().includes('nenhum'));
assert.equal(wishlistHeading(1, true).subtitle, '1 produto salvo');
assert.equal(wishlistHeading(3, true).subtitle, '3 produtos salvos');

assert.equal(formatWishlistBadge(0), null);
assert.equal(formatWishlistBadge(-2), null);
assert.equal(formatWishlistBadge(4), '4');
assert.equal(formatWishlistBadge(FAVORITES_MAX_BADGE + 5), `${FAVORITES_MAX_BADGE}+`);

assert.ok(wishlistAddToast().includes('favoritos'));
assert.ok(wishlistRemoveToast().includes('Removido'));
assert.ok(wishlistNeedLoginToast().toLowerCase().includes('entre'));
assert.ok(wishlistAlreadyToast().includes('já'));
assert.equal(wishlistRemoveLabel(), 'Remover');
assert.equal(wishlistToggleLabel(false), 'Favoritar');
assert.equal(wishlistToggleLabel(true), 'Nos favoritos');

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

console.log('wishlist-ui unit tests ok');
