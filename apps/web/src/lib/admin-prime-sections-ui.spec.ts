import assert from 'assert';
import { ENTERPRISE_MISSING } from './admin-enterprise-ui';
import {
  avaliacoesPrimeModel,
  clientesPrimeModel,
  cuponsPrimeModel,
  equipePrimeModel,
  fretePrimeModel,
  marketplacePrimeModel,
  notificacoesPrimeModel,
  vitrinePrimeModel,
} from './admin-prime-sections-ui';

const pending = clientesPrimeModel({ load: 'pending', total: 0, items: [] });
assert.equal(pending.kpis.every((kpi) => kpi.value === ENTERPRISE_MISSING), true, 'clientes pending stays —');
assert.equal(pending.attention.length, 0, 'clientes pending invents no alert');
assert.ok(pending.summary.includes('Lendo'), 'clientes pending does not claim zero');

const zeroCustomers = clientesPrimeModel({ load: 'ready', total: 0, items: [] });
assert.equal(zeroCustomers.kpis.find((kpi) => kpi.id === 'total')?.value, '0', 'clientes total zero stays zero');
assert.equal(zeroCustomers.kpis.find((kpi) => kpi.id === 'shown')?.value, '0');
assert.equal(zeroCustomers.attention.length, 0);

const customers = clientesPrimeModel({
  load: 'ready',
  total: 60,
  items: [
    { status: 'active', phone: '47999990000', paidOrdersCount: 2 },
    { status: 'blocked', phone: '', paidOrdersCount: 0 },
    { status: '', phone: null, paidOrdersCount: 1 },
  ],
});
assert.equal(customers.kpis.find((kpi) => kpi.id === 'inactive')?.value, ENTERPRISE_MISSING, 'missing status does not become active');
assert.equal(customers.kpis.find((kpi) => kpi.id === 'total')?.value, '60');
assert.ok(customers.signals.some((item) => item.code === 'customers_truncated'));
assert.equal(customers.attention.length, 0, 'incomplete status does not raise a partial inactive alert');

const knownCustomers = clientesPrimeModel({
  load: 'ready',
  total: 2,
  items: [
    { status: 'active', phone: '47999990000', paidOrdersCount: 0 },
    { status: 'inactive', phone: null, paidOrdersCount: 0 },
  ],
});
assert.equal(knownCustomers.kpis.find((kpi) => kpi.id === 'paid')?.value, '0', 'zero paid orders stays zero');
assert.equal(knownCustomers.attention[0]?.code, 'customers_inactive');
assert.equal(knownCustomers.attention[0]?.count, 1);

const fretePending = fretePrimeModel({ load: 'pending', settings: null, rules: [] });
assert.equal(fretePending.kpis.every((kpi) => kpi.value === ENTERPRISE_MISSING), true);
assert.equal(fretePending.signals.length, 0, 'empty rules before load are not zero zones');

const freteZero = fretePrimeModel({
  load: 'ready',
  settings: { freeAbove: 0, defaultFee: 0, defaultDays: 5 },
  rules: [],
});
assert.ok(freteZero.kpis.find((kpi) => kpi.id === 'free')?.value.includes('0'), 'free above zero stays zero');
assert.ok(freteZero.kpis.find((kpi) => kpi.id === 'fee')?.value.includes('0'));
assert.equal(freteZero.kpis.find((kpi) => kpi.id === 'zones')?.value, '0');
assert.equal(freteZero.signals[0]?.code, 'shipping_no_zones');
assert.equal(freteZero.signals[0]?.count, 0);
assert.equal(freteZero.attention.length, 0);

const freteOff = fretePrimeModel({
  load: 'ready',
  settings: { freeAbove: 299, defaultFee: 19.9, defaultDays: 5 },
  rules: [{ active: false }, { active: false }],
});
assert.equal(freteOff.attention[0]?.code, 'shipping_no_active_zone');
assert.equal(freteOff.kpis.find((kpi) => kpi.id === 'zones')?.value, '0');

const freteMissingDays = fretePrimeModel({
  load: 'ready',
  settings: { freeAbove: 10, defaultFee: null, defaultDays: null },
  rules: [{ active: true }],
});
assert.equal(freteMissingDays.kpis.find((kpi) => kpi.id === 'fee')?.value, ENTERPRISE_MISSING);
assert.equal(freteMissingDays.kpis.find((kpi) => kpi.id === 'days')?.value, ENTERPRISE_MISSING);

const vitrinePending = vitrinePrimeModel({
  load: 'pending',
  banners: [],
  seo: null,
  opsReady: false,
  uploads: { persistent: false, dir: '/tmp' },
  uploadsAlert: { code: 'uploads_ephemeral', message: 'efêmero', count: 0 },
});
assert.equal(vitrinePending.kpis.find((kpi) => kpi.id === 'banners')?.value, ENTERPRISE_MISSING);
assert.equal(vitrinePending.kpis.find((kpi) => kpi.id === 'uploads')?.value, ENTERPRISE_MISSING);
assert.equal(vitrinePending.attention.length, 0, 'uploads alert waits for the ops snapshot flag');

const vitrineZero = vitrinePrimeModel({
  load: 'ready',
  banners: [],
  seo: { siteTitle: 'Loja', ogImageUrl: '' },
  opsReady: true,
  uploads: null,
  uploadsAlert: null,
});
assert.equal(vitrineZero.kpis.find((kpi) => kpi.id === 'active')?.value, '0');
assert.equal(vitrineZero.attention[0]?.code, 'banners_none_active');
assert.equal(vitrineZero.attention[0]?.count, 0);
assert.ok(vitrineZero.signals.some((item) => item.code === 'seo_og_missing'));
assert.equal(vitrineZero.kpis.find((kpi) => kpi.id === 'uploads')?.value, ENTERPRISE_MISSING, 'omitted uploads stay —');

const vitrineUploads = vitrinePrimeModel({
  load: 'ready',
  banners: [{ active: true }],
  seo: { siteTitle: 'Loja', ogImageUrl: 'https://cdn.example/og.png' },
  opsReady: true,
  uploads: { persistent: false, dir: '/tmp' },
  uploadsAlert: {
    code: 'uploads_ephemeral',
    severity: 'warn',
    message: 'UPLOADS_DIR fora de /data',
    count: 0,
    recommendedAction: 'Montar Volume em /data/uploads',
  },
});
assert.equal(vitrineUploads.attention[0]?.code, 'uploads_ephemeral');
assert.ok(String(vitrineUploads.kpis.find((kpi) => kpi.id === 'uploads')?.value).includes('efêmero'));
assert.equal(vitrineUploads.signals.some((item) => item.code === 'seo_og_missing'), false);

const couponsPending = cuponsPrimeModel({ load: 'pending', coupons: [] });
assert.equal(couponsPending.kpis.every((kpi) => kpi.value === ENTERPRISE_MISSING), true);
assert.equal(couponsPending.attention.length, 0);

const couponsZero = cuponsPrimeModel({ load: 'ready', coupons: [] });
assert.equal(couponsZero.kpis.find((kpi) => kpi.id === 'total')?.value, '0');
assert.equal(couponsZero.kpis.find((kpi) => kpi.id === 'uses')?.value, '0');
assert.equal(couponsZero.attention.length, 0);

const coupons = cuponsPrimeModel({
  load: 'ready',
  now: Date.parse('2026-09-22T12:00:00.000Z'),
  coupons: [
    { active: true, endsAt: '2020-01-01T00:00:00.000Z', maxUses: 2, usedCount: 2, reservedCount: 0 },
    { active: true, endsAt: null, maxUses: null, usedCount: 0, reservedCount: 1 },
    { active: false, endsAt: '2020-01-01T00:00:00.000Z', maxUses: 1, usedCount: 1, reservedCount: 0 },
  ],
});
assert.equal(coupons.kpis.find((kpi) => kpi.id === 'active')?.value, '2');
assert.equal(coupons.kpis.find((kpi) => kpi.id === 'uses')?.value, '3');
assert.equal(coupons.attention.map((item) => item.code).sort().join(','), 'coupons_exhausted_active,coupons_expired_active');

const couponsGap = cuponsPrimeModel({
  load: 'ready',
  coupons: [{ active: true, usedCount: null, reservedCount: 0 }],
});
assert.equal(couponsGap.kpis.find((kpi) => kpi.id === 'uses')?.value, ENTERPRISE_MISSING);

const teamPending = equipePrimeModel({ load: 'pending', admins: [] });
assert.equal(teamPending.kpis.find((kpi) => kpi.id === 'active')?.value, ENTERPRISE_MISSING);
assert.equal(teamPending.attention.length, 0);

const teamZero = equipePrimeModel({ load: 'ready', admins: [] });
assert.equal(teamZero.kpis.find((kpi) => kpi.id === 'active')?.value, '0');
assert.equal(teamZero.attention[0]?.code, 'admins_none_active');
assert.equal(teamZero.attention[0]?.count, 0);

const team = equipePrimeModel({
  load: 'ready',
  admins: [
    { status: 'active', role: 'admin' },
    { status: 'disabled', role: 'admin' },
  ],
});
assert.equal(team.kpis.find((kpi) => kpi.id === 'inactive')?.value, '1');
assert.equal(team.kpis.find((kpi) => kpi.id === 'roles')?.value, '1');
assert.equal(team.signals[0]?.code, 'admins_inactive');

const reviewsEmpty = avaliacoesPrimeModel({ load: 'ready', reviews: [] });
assert.equal(reviewsEmpty.kpis.find((kpi) => kpi.id === 'total')?.value, '0');
assert.equal(reviewsEmpty.kpis.find((kpi) => kpi.id === 'published')?.value, '0');
assert.equal(reviewsEmpty.kpis.find((kpi) => kpi.id === 'average')?.value, ENTERPRISE_MISSING, 'empty average is not zero');

const reviewsGap = avaliacoesPrimeModel({
  load: 'ready',
  reviews: [{ status: 'published', rating: 4 }, { status: 'hidden', rating: null }],
});
assert.equal(reviewsGap.kpis.find((kpi) => kpi.id === 'average')?.value, ENTERPRISE_MISSING);
assert.equal(reviewsGap.kpis.find((kpi) => kpi.id === 'hidden')?.value, '1');
assert.equal(reviewsGap.signals[0]?.code, 'reviews_hidden');
assert.equal(reviewsGap.attention.length, 0, 'hidden is a signal, not a new status');

const pushPending = notificacoesPrimeModel({
  load: 'pending',
  enabledDevices: 0,
  firebaseConfigured: false,
  campaigns: [],
  tokenCount: 0,
  abandoned: { openViews: 0, dueViews: 0, sentLast7Days: 0 },
});
assert.equal(pushPending.kpis.every((kpi) => kpi.value === ENTERPRISE_MISSING), true);
assert.equal(pushPending.attention.length, 0, 'firebase false before load is not an alert');

const pushOff = notificacoesPrimeModel({
  load: 'ready',
  enabledDevices: 0,
  firebaseConfigured: false,
  campaigns: [],
  tokenCount: 0,
  abandoned: { openViews: 0, dueViews: 0, sentLast7Days: 0 },
});
assert.equal(pushOff.kpis.find((kpi) => kpi.id === 'devices')?.value, '0');
assert.equal(pushOff.kpis.find((kpi) => kpi.id === 'abandoned')?.value, '0');
assert.equal(pushOff.attention[0]?.code, 'push_firebase_off');

const pushGap = notificacoesPrimeModel({
  load: 'ready',
  enabledDevices: null,
  firebaseConfigured: null,
  campaigns: [{ status: 'failed' }],
  tokenCount: null,
  abandoned: null,
});
assert.equal(pushGap.kpis.find((kpi) => kpi.id === 'devices')?.value, ENTERPRISE_MISSING);
assert.equal(pushGap.kpis.find((kpi) => kpi.id === 'firebase')?.value, ENTERPRISE_MISSING);
assert.equal(pushGap.kpis.find((kpi) => kpi.id === 'abandoned')?.value, ENTERPRISE_MISSING);
assert.equal(pushGap.attention.some((item) => item.code === 'push_firebase_off'), false);
assert.equal(pushGap.attention[0]?.code, 'push_campaigns_failed');

const marketPending = marketplacePrimeModel({
  load: 'pending',
  sellers: [],
  commissions: [],
  commissionFilter: 'pending',
});
assert.equal(marketPending.kpis.every((kpi) => kpi.value === ENTERPRISE_MISSING), true);
assert.equal(marketPending.attention.length, 0);

const market = marketplacePrimeModel({
  load: 'ready',
  sellers: [
    { status: 'active', mpOAuthStatus: 'linked', _count: { products: 2 } },
    { status: 'active', mpOAuthStatus: 'pending', _count: { products: 0 } },
    { status: 'pending', mpOAuthStatus: 'expired', _count: { products: 1 } },
  ],
  commissions: [
    { status: 'pending', amount: 10 },
    { status: 'pending', amount: 0 },
  ],
  commissionFilter: 'pending',
});
assert.equal(market.kpis.find((kpi) => kpi.id === 'products')?.value, '3');
assert.equal(market.attention.map((item) => item.code).sort().join(','), 'sellers_active_unlinked,sellers_mp_problem,sellers_pending');
assert.equal(market.signals[0]?.code, 'commissions_pending');
assert.ok(market.signals[0]?.evidenceLine?.includes('10'), 'pending commission sum keeps the zero row');

const marketAmountGap = marketplacePrimeModel({
  load: 'ready',
  sellers: [{ status: 'active', mpOAuthStatus: 'linked' }],
  commissions: [{ status: 'pending', amount: 'nope' }],
  commissionFilter: 'all',
});
assert.equal(marketAmountGap.kpis.find((kpi) => kpi.id === 'products')?.value, ENTERPRISE_MISSING);
assert.equal(marketAmountGap.signals[0]?.evidenceLine, null, 'bad amount does not become zero');

const marketOtherFilter = marketplacePrimeModel({
  load: 'ready',
  sellers: [],
  commissions: [],
  commissionFilter: 'paid',
});
assert.equal(marketOtherFilter.kpis.find((kpi) => kpi.id === 'sellers')?.value, '0');
assert.equal(marketOtherFilter.kpis.find((kpi) => kpi.id === 'active')?.value, '0');
assert.equal(marketOtherFilter.actions.find((action) => action.id === 'commissions')?.figure, null);
assert.equal(marketOtherFilter.attention.length, 0, 'filtro pago não vira alerta de comissão pendente');

console.log('admin-prime-sections-ui.spec ok');
