import assert from 'assert';
import {
  adminTableDensityClass,
  adminUserStatusLabel,
  adminUserStatusTone,
  bannerActiveLabel,
  catalogNeedsPhotoSummary,
  commissionLedgerConfirmCopy,
  commissionStatusLabel,
  commissionStatusTone,
  couponIsExhausted,
  couponIsExpired,
  couponListStats,
  couponNotStarted,
  couponStartsAtLine,
  customerAccountLabel,
  customerAccountTone,
  orderStatusChipClass,
  orderStatusChipTone,
  paidQueueBannerClass,
  paidQueueBannerTone,
  productActiveChipClass,
  productActiveLabel,
  productPhotoBadgeKind,
  productPhotoBadgeLabel,
  productStockChipClass,
  productStockTone,
  reviewStars,
  reviewStatusLabel,
  reviewStatusTone,
  salesPresetActive,
  sellerMpOAuthLabel,
  sellerMpOAuthTone,
  sellerStatusConfirmCopy,
  sellerStatusLabel,
  sellerStatusTone,
  shippingSortOrderLine,
  shippingZoneActiveLabel,
  shouldStickyOrderActions,
} from './admin-pro-ui';

assert.equal(orderStatusChipTone('paid'), 'accent');
assert.equal(orderStatusChipTone('organizing'), 'warn');
assert.equal(orderStatusChipTone('separating'), 'warn');
assert.equal(orderStatusChipTone('packing'), 'warn');
assert.equal(orderStatusChipTone('in_transit'), 'info');
assert.equal(orderStatusChipTone('delivered'), 'ok');
assert.equal(orderStatusChipTone('cancelled'), 'danger');
assert.equal(orderStatusChipTone('awaiting_payment'), 'neutral');
assert.ok(orderStatusChipClass('paid').includes('admin-chip-status--accent'));

assert.equal(paidQueueBannerTone({ paidAwaitingCount: 0, stuckCount: 0 }), 'empty');
assert.equal(paidQueueBannerTone({ paidAwaitingCount: 3, stuckCount: 0 }), 'active');
assert.equal(paidQueueBannerTone({ paidAwaitingCount: 3, stuckCount: 1 }), 'stuck');
assert.ok(paidQueueBannerClass('stuck').includes('admin-queue-banner--stuck'));

assert.equal(shouldStickyOrderActions('paid'), true);
assert.equal(shouldStickyOrderActions('organizing'), true);
assert.equal(shouldStickyOrderActions('separating'), true);
assert.equal(shouldStickyOrderActions('packing'), false);
assert.equal(shouldStickyOrderActions('delivered'), false);

assert.equal(
  productPhotoBadgeKind({ hasUrl: false, isPlaceholderOrMissing: true }),
  'missing',
);
assert.equal(
  productPhotoBadgeKind({ hasUrl: true, isPlaceholderOrMissing: true }),
  'placeholder',
);
assert.equal(
  productPhotoBadgeKind({ hasUrl: true, isPlaceholderOrMissing: false }),
  'ok',
);
assert.equal(productPhotoBadgeLabel('missing'), 'Sem foto');
assert.equal(productPhotoBadgeLabel('placeholder'), 'Foto placeholder');
assert.equal(productPhotoBadgeLabel('ok'), null);

assert.equal(productStockTone(0, 5, true), 'danger');
assert.equal(productStockTone(3, 5, true), 'warn');
assert.equal(productStockTone(20, 5, true), 'ok');
assert.equal(productStockTone(0, 5, false), 'neutral');
assert.equal(productActiveLabel(true), 'Ativo');
assert.equal(productActiveLabel(false), 'Inativo');
assert.ok(productActiveChipClass(true).includes('--ok'));
assert.ok(productStockChipClass(2, 5).includes('--warn'));

assert.ok(catalogNeedsPhotoSummary(2).includes('2 produto'));
assert.ok(catalogNeedsPhotoSummary(2).includes('Enviar foto'));
assert.equal(catalogNeedsPhotoSummary(0), '');
assert.ok(adminTableDensityClass(true).includes('admin-table--dense'));

assert.equal(customerAccountTone('active'), 'ok');
assert.equal(customerAccountTone('blocked'), 'danger');
assert.equal(customerAccountLabel('blocked'), 'Bloqueado');
assert.equal(customerAccountLabel('active'), 'Ativo');

assert.equal(sellerStatusTone('pending'), 'warn');
assert.equal(sellerStatusTone('active'), 'ok');
assert.equal(sellerStatusTone('suspended'), 'danger');
assert.equal(sellerStatusLabel('pending'), 'Pendente');
assert.equal(sellerStatusLabel('active'), 'Ativo');
assert.equal(sellerStatusLabel('suspended'), 'Suspenso');

assert.equal(sellerMpOAuthLabel('linked'), 'MP vinculado');
assert.equal(sellerMpOAuthLabel('pending'), 'MP não vinculado');
assert.equal(sellerMpOAuthLabel(null), 'MP não vinculado');
assert.equal(sellerMpOAuthLabel('expired'), 'MP expirado');
assert.equal(sellerMpOAuthLabel('revoked'), 'MP revogado');
assert.equal(sellerMpOAuthTone('linked'), 'ok');
assert.equal(sellerMpOAuthTone('pending'), 'warn');
assert.equal(sellerMpOAuthTone('expired'), 'danger');
assert.equal(sellerMpOAuthTone('revoked'), 'danger');

assert.equal(commissionStatusTone('pending'), 'warn');
assert.equal(commissionStatusTone('approved'), 'info');
assert.equal(commissionStatusTone('paid'), 'ok');
assert.equal(commissionStatusLabel('pending'), 'Pendente');
assert.equal(commissionStatusLabel('approved'), 'Aprovada');
assert.equal(commissionStatusLabel('paid'), 'Paga');

assert.equal(couponIsExpired(null), false);
assert.equal(couponIsExpired('2099-01-01T00:00:00.000Z', Date.parse('2026-01-01T00:00:00.000Z')), false);
assert.equal(couponIsExpired('2020-01-01T00:00:00.000Z', Date.parse('2026-01-01T00:00:00.000Z')), true);
assert.equal(couponIsExhausted(null, 10), false);
assert.equal(couponIsExhausted(10, 9), false);
assert.equal(couponIsExhausted(10, 10), true);
assert.equal(couponNotStarted(null), false);
assert.equal(couponNotStarted(undefined), false);
assert.equal(couponNotStarted('2099-01-01T00:00:00.000Z', Date.parse('2026-01-01T00:00:00.000Z')), true);
assert.equal(couponNotStarted('2020-01-01T00:00:00.000Z', Date.parse('2026-01-01T00:00:00.000Z')), false);
assert.equal(couponStartsAtLine(undefined).includes('—'), true);
assert.equal(couponStartsAtLine(null), 'sem início');
assert.equal(couponStartsAtLine(''), 'sem início');
assert.equal(shippingSortOrderLine(0), 'ordem 0');
assert.equal(shippingSortOrderLine(undefined).includes('—'), true);
const approve = commissionLedgerConfirmCopy({ kind: 'approve', sellerName: 'Ana', amountLabel: 'R$ 0,00' });
assert.ok(approve.title.includes('Ana'));
assert.ok(approve.title.includes('R$ 0,00'));
assert.ok(approve.detail.includes('PATCH /admin/commissions/:id/approve'));
assert.ok(approve.detail.includes('Não cobra'));
assert.ok(approve.detail.includes('não grava no Mercado Pago'));
const paid = commissionLedgerConfirmCopy({ kind: 'paid', sellerName: '', amountLabel: '' });
assert.ok(paid.title.includes('—'));
assert.ok(paid.detail.includes('PATCH /admin/commissions/:id/paid'));
assert.ok(paid.detail.includes('Não cobra'));
const suspend = sellerStatusConfirmCopy({ name: 'Loja', toStatus: 'suspended' });
assert.ok(suspend.title.includes('Suspender'));
assert.ok(suspend.detail.includes('PATCH /admin/sellers/:id/status'));
assert.ok(suspend.detail.includes('Não abre OAuth'));

const stats = couponListStats([
  { active: true, usedCount: 2, reservedCount: 1 },
  { active: false, usedCount: 3, reservedCount: 0 },
  { active: true, usedCount: 0, reservedCount: 4 },
]);
assert.equal(stats.active, 2);
assert.equal(stats.inactive, 1);
assert.equal(stats.uses, 5);
assert.equal(stats.reserved, 5);

assert.equal(reviewStatusTone('published'), 'ok');
assert.equal(reviewStatusTone('hidden'), 'neutral');
assert.equal(reviewStatusLabel('published'), 'Publicada');
assert.equal(reviewStatusLabel('hidden'), 'Oculta');
assert.equal(reviewStars(5), '★★★★★');
assert.equal(reviewStars(3), '★★★☆☆');
assert.equal(reviewStars(0), '☆☆☆☆☆');
assert.equal(reviewStars(9), '★★★★★');

assert.equal(adminUserStatusTone('active'), 'ok');
assert.equal(adminUserStatusTone('blocked'), 'neutral');
assert.equal(adminUserStatusLabel('active'), 'Ativo');
assert.equal(adminUserStatusLabel('blocked'), 'Desativado');
assert.equal(bannerActiveLabel(true), 'Ativo');
assert.equal(bannerActiveLabel(false), 'Inativo');
assert.equal(shippingZoneActiveLabel(true), 'Ativa');
assert.equal(shippingZoneActiveLabel(false), 'Inativa');
assert.equal(salesPresetActive('2026-09-17', '2026-09-17', '2026-09-17', '2026-09-17'), true);
assert.equal(salesPresetActive('2026-09-01', '2026-09-17', '2026-09-17', '2026-09-17'), false);

console.log('admin-pro-ui web unit ok');
