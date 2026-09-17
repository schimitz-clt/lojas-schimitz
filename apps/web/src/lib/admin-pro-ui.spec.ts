import assert from 'assert';
import {
  adminTableDensityClass,
  catalogNeedsPhotoSummary,
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
assert.equal(catalogNeedsPhotoSummary(0), '');
assert.ok(adminTableDensityClass(true).includes('admin-table--dense'));

console.log('admin-pro-ui web unit ok');
