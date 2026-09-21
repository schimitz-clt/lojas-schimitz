import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import { pixChargeAmount } from '../../common/pricing';
import {
  abandonedViewAdminNote,
  abandonedViewDelayMs,
  abandonedViewMaxAgeMs,
  abandonedViewMessage,
  decideAbandonedView,
  formatBrl,
  isSameSaoPauloDay,
  nextSaoPauloMidnight,
  normalizePushDeviceId,
  orderQualifiesAsPostViewPurchase,
  purchaseUserIds,
  PUSH_DEVICE_COOKIE,
  readPushDeviceCookie,
  saoPauloDayKey,
  withinDeviceDayCap,
  withinProductCap,
  type AbandonedViewAction,
  type AbandonedViewFacts,
} from './abandoned-view.rules';

const DEVICE = '11111111-1111-4111-8111-111111111111';
const TWO_H = 2 * 60 * 60 * 1000;

function facts(partial: Partial<AbandonedViewFacts> & Pick<AbandonedViewFacts, 'now' | 'lastViewedAt'>): AbandonedViewFacts {
  return {
    handledViewAt: null,
    delayMs: TWO_H,
    maxAgeMs: 48 * 60 * 60 * 1000,
    deviceEnabled: true,
    productActive: true,
    availableQty: 3,
    purchasedAfterView: false,
    lastProductPushAt: null,
    lastDevicePushAt: null,
    firebaseConfigured: true,
    ...partial,
  };
}

assert.equal(abandonedViewDelayMs({} as NodeJS.ProcessEnv), TWO_H);
assert.equal(
  abandonedViewDelayMs({ ABANDONED_VIEW_DELAY_HOURS: '2' } as NodeJS.ProcessEnv),
  TWO_H,
);
assert.equal(
  abandonedViewDelayMs({ ABANDONED_VIEW_DELAY_HOURS: 'nope' } as NodeJS.ProcessEnv),
  TWO_H,
);
const oneMin = abandonedViewDelayMs({ ABANDONED_VIEW_DELAY_HOURS: '0.0167' } as NodeJS.ProcessEnv);
assert.ok(oneMin >= 60_000 && oneMin < 120_000, `staging minute delay, got ${oneMin}`);
assert.equal(
  abandonedViewDelayMs({ ABANDONED_VIEW_DELAY_HOURS: '0.0001' } as NodeJS.ProcessEnv),
  60_000,
);
assert.ok(abandonedViewMaxAgeMs({} as NodeJS.ProcessEnv) >= 48 * 60 * 60 * 1000);

const evening = new Date('2026-09-22T02:30:00.000Z');
const afterMidnight = new Date('2026-09-22T03:30:00.000Z');
assert.equal(saoPauloDayKey(evening), '2026-09-21');
assert.equal(saoPauloDayKey(afterMidnight), '2026-09-22');
assert.equal(isSameSaoPauloDay(evening, new Date('2026-09-22T01:00:00.000Z')), true);
assert.equal(withinDeviceDayCap(evening, new Date('2026-09-22T02:50:00.000Z')), true);
assert.equal(withinDeviceDayCap(evening, afterMidnight), false);
assert.equal(nextSaoPauloMidnight(evening).toISOString(), '2026-09-22T03:00:00.000Z');
assert.equal(withinDeviceDayCap(null, afterMidnight), false);

const now = new Date('2026-09-21T18:00:00.000Z');
assert.equal(withinProductCap(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000), now), true);
assert.equal(withinProductCap(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), now), false);
assert.equal(withinProductCap(null, now), false);

assert.equal(orderQualifiesAsPostViewPurchase('draft'), false);
assert.equal(orderQualifiesAsPostViewPurchase('cancelled'), false);
assert.equal(orderQualifiesAsPostViewPurchase('awaiting_payment'), true);
assert.equal(orderQualifiesAsPostViewPurchase('paid'), true);
assert.equal(orderQualifiesAsPostViewPurchase('refunded'), true);
assert.deepEqual(purchaseUserIds(null, null), []);
assert.deepEqual(purchaseUserIds('user-a', 'user-a'), ['user-a']);
assert.deepEqual(purchaseUserIds('user-a', 'user-b'), ['user-a', 'user-b']);

assert.equal(formatBrl(95), 'R$ 95,00');
assert.equal(formatBrl(1234.5), 'R$ 1.234,50');
assert.equal(pixChargeAmount(100), 95);

const msg = abandonedViewMessage({
  productName: 'Sansung A54',
  listPrice: 100,
  slug: 'sansung-a54',
});
assert.ok(msg);
assert.equal(msg?.pixLabel, 'R$ 95,00');
assert.ok(msg!.title.includes('Sansung A54'));
assert.ok(msg!.body.includes('Vem comprar seu produto Sansung A54'));
assert.ok(msg!.body.includes('R$ 95,00'));
assert.ok(msg!.body.includes('no PIX'));
assert.ok(msg!.body.includes('Estamos aguardando'));
assert.ok(msg!.body.includes('Lojas Schimitz agradece'));
assert.equal(msg!.linkPath, '/produto/sansung-a54');
assert.ok(msg!.linkUrl.endsWith('/produto/sansung-a54'));
assert.ok(msg!.title.length <= 80);
assert.ok(msg!.body.length <= 240);

const long = abandonedViewMessage({
  productName: 'Geladeira '.repeat(40),
  listPrice: 1999.9,
  slug: 'geladeira-x',
});
assert.ok(long);
assert.ok(long!.body.length <= 240);
assert.ok(long!.body.endsWith('Lojas Schimitz agradece.') || long!.body.includes('Lojas Schimitz agradece'));
assert.equal(abandonedViewMessage({ productName: 'X', listPrice: 10, slug: '../etc' }), null);
assert.equal(abandonedViewMessage({ productName: 'X', listPrice: 10, slug: 'a/b' }), null);

function expectDecision(d: AbandonedViewAction, action: AbandonedViewAction['action'], reason?: string) {
  assert.equal(d.action, action);
  if (d.action === 'send') {
    assert.equal(reason, undefined);
    return;
  }
  assert.equal(d.reason, reason);
}

const viewed = new Date(now.getTime() - TWO_H);
expectDecision(decideAbandonedView(facts({ now, lastViewedAt: viewed })), 'send');
expectDecision(
  decideAbandonedView(facts({ now, lastViewedAt: new Date(now.getTime() - 30 * 60 * 1000) })),
  'wait',
  'not_due',
);
expectDecision(
  decideAbandonedView(facts({ now, lastViewedAt: viewed, handledViewAt: viewed })),
  'close',
  'already_handled',
);
expectDecision(
  decideAbandonedView(
    facts({
      now,
      lastViewedAt: viewed,
      handledViewAt: new Date(viewed.getTime() - 60_000),
    }),
  ),
  'send',
);
expectDecision(
  decideAbandonedView(facts({ now, lastViewedAt: new Date(now.getTime() - 72 * 60 * 60 * 1000) })),
  'close',
  'stale',
);
expectDecision(
  decideAbandonedView(facts({ now, lastViewedAt: viewed, deviceEnabled: false })),
  'close',
  'device_disabled',
);
expectDecision(
  decideAbandonedView(facts({ now, lastViewedAt: viewed, availableQty: 0 })),
  'close',
  'unavailable',
);
expectDecision(
  decideAbandonedView(facts({ now, lastViewedAt: viewed, productActive: false })),
  'close',
  'unavailable',
);
expectDecision(
  decideAbandonedView(facts({ now, lastViewedAt: viewed, purchasedAfterView: true })),
  'close',
  'purchased',
);
const productCap = decideAbandonedView(
  facts({
    now,
    lastViewedAt: viewed,
    lastProductPushAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
  }),
);
expectDecision(productCap, 'wait', 'product_cap');
if (productCap.action === 'wait' && productCap.reason === 'product_cap') {
  assert.ok(productCap.deferUntil.getTime() > now.getTime());
}
const dayCap = decideAbandonedView(
  facts({
    now,
    lastViewedAt: viewed,
    lastDevicePushAt: new Date(now.getTime() - 60 * 60 * 1000),
  }),
);
expectDecision(dayCap, 'wait', 'device_day_cap');
if (dayCap.action === 'wait' && dayCap.reason === 'device_day_cap') {
  assert.equal(dayCap.deferUntil.toISOString(), nextSaoPauloMidnight(now).toISOString());
}
expectDecision(
  decideAbandonedView(facts({ now, lastViewedAt: viewed, firebaseConfigured: false })),
  'defer',
  'firebase_not_configured',
);

assert.equal(normalizePushDeviceId(DEVICE), DEVICE);
assert.equal(normalizePushDeviceId('fcm-token-not-a-uuid-0123456789abcdef'), null);
assert.equal(
  readPushDeviceCookie(`sch_access=secret; ${PUSH_DEVICE_COOKIE}=${DEVICE}`),
  DEVICE,
);
assert.equal(readPushDeviceCookie('sch_access=secret; sch_refresh=secret'), null);
assert.ok(abandonedViewAdminNote(2).includes('automática'));
assert.ok(abandonedViewAdminNote(2).includes('não dispara'));

const service = readFileSync(join(__dirname, 'abandoned-view.service.ts'), 'utf8');
assert.ok(service.includes('sendToTokens'), 'reuses FCM client');
assert.ok(service.includes('abandonedViewPush'), 'persists send log');
assert.ok(service.includes("status: 'approved'"), 'real payment status');
assert.ok(service.includes("notIn: ['draft', 'cancelled']"), 'real order statuses');
assert.ok(service.includes('productViewEvent'), 'persists views');
assert.ok(!service.includes('NullProvider'), 'no null provider');
assert.ok(!/mock|faker|hardcoded token/i.test(service), 'no mocks');
const scheduler = readFileSync(join(__dirname, 'push-scheduler.service.ts'), 'utf8');
assert.ok(scheduler.includes('processDue'), 'worker runs abandoned views');
const migration = readFileSync(
  join(__dirname, '../../../../../prisma/migrations/20260922_abandoned_product_view/migration.sql'),
  'utf8',
);
assert.ok(migration.includes('CREATE TABLE "ProductViewEvent"'));
assert.ok(migration.includes('"deferUntil"'));
assert.ok(migration.includes('CREATE TABLE "AbandonedViewPush"'));
assert.ok(!/DROP TABLE/i.test(migration), 'additive migration');

console.log('abandoned-view.rules.spec ok');
