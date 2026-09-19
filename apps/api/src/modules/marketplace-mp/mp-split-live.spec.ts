import assert from 'assert';
import { commissionAmount } from '../commissions/commissions.constants';
import { pixIntentChargeAmount } from '../../common/pricing';
import {
  customerMarketplaceSplitPreview,
  decideLiveSplit,
  decideMarketplaceSplit,
  isLiveSplitHostEnv,
  isLiveSplitMoneyPathAllowed,
} from './mp-split-live';

const partner = {
  id: 'seller-p',
  slug: 'parceiro',
  mpOAuthStatus: 'linked' as const,
  mpUserId: '123',
  mpPublicKey: 'APP_USR-pk-seller-live',
  commissionPercent: 10,
};
const house = {
  id: 'seller-h',
  slug: 'lojas-schimitz',
  mpOAuthStatus: 'linked' as const,
  mpUserId: '1',
  mpPublicKey: 'APP_USR-pk-house',
  commissionPercent: 10,
};

const liveEnv: NodeJS.ProcessEnv = {
  APP_ENV: 'production',
  NODE_ENV: 'production',
  MP_MARKETPLACE_SPLIT_ENABLED: 'true',
  MP_MARKETPLACE_SPLIT_ALLOW_LIVE: 'true',
  MERCADO_PAGO_ACCESS_TOKEN: 'APP_USR-platform-live',
};

const sandboxEnv: NodeJS.ProcessEnv = {
  APP_ENV: 'development',
  NODE_ENV: 'development',
  MP_MARKETPLACE_SPLIT_ENABLED: 'true',
  MP_MARKETPLACE_SPLIT_ALLOW_LIVE: 'false',
  MERCADO_PAGO_ACCESS_TOKEN: 'TEST-platform',
};

assert.equal(isLiveSplitHostEnv(liveEnv), true);
assert.equal(isLiveSplitHostEnv({ APP_ENV: 'staging', NODE_ENV: 'production' }), true);
assert.equal(isLiveSplitHostEnv({ APP_ENV: 'development', NODE_ENV: 'development' }), false);

assert.equal(isLiveSplitMoneyPathAllowed(liveEnv), true);
assert.equal(
  isLiveSplitMoneyPathAllowed({ ...liveEnv, MP_MARKETPLACE_SPLIT_ALLOW_LIVE: 'false' }),
  false,
  'ALLOW_LIVE=false never uses live path',
);
assert.equal(
  isLiveSplitMoneyPathAllowed({ ...liveEnv, MP_MARKETPLACE_SPLIT_ENABLED: 'false' }),
  false,
  'ENABLED=false never opens live path',
);
assert.equal(
  isLiveSplitMoneyPathAllowed({
    ...liveEnv,
    APP_ENV: 'development',
    NODE_ENV: 'development',
    RAILWAY_ENVIRONMENT: undefined,
    RAILWAY_ENVIRONMENT_NAME: undefined,
  }),
  false,
  'non-prod-like host never uses live path',
);
assert.equal(
  isLiveSplitMoneyPathAllowed({ ...liveEnv, MERCADO_PAGO_ACCESS_TOKEN: 'TEST-platform' }),
  false,
  'TEST- platform token is not live',
);
assert.equal(isLiveSplitMoneyPathAllowed(sandboxEnv), false);

const liveBase = {
  env: liveEnv,
  providerName: 'mercadopago',
  items: [{ sellerId: partner.id }],
  seller: partner,
  chargeAmount: 100,
  sellerAccessToken: 'APP_USR-seller-live',
};

const liveOk = decideLiveSplit(liveBase);
assert.equal(liveOk.use, true);
if (liveOk.use) {
  assert.equal(liveOk.applicationFee, 10);
  assert.equal(liveOk.percent, 10);
  assert.equal(liveOk.reason, 'live_seller_oauth_v1');
}

assert.equal(decideLiveSplit({ ...liveBase, seller: house }).use, false);
assert.equal(decideLiveSplit({ ...liveBase, seller: house }).reason, 'house_brand');
assert.equal(decideLiveSplit({ ...liveBase, seller: { ...partner, mpOAuthStatus: 'pending' } }).use, false);
assert.equal(decideLiveSplit({ ...liveBase, items: [] }).use, false);
assert.equal(
  decideLiveSplit({
    ...liveBase,
    items: [{ sellerId: partner.id }, { sellerId: house.id }],
  }).use,
  false,
);
assert.equal(decideLiveSplit({ ...liveBase, sellerAccessToken: 'TEST-seller' }).use, false);
assert.equal(decideLiveSplit({ ...liveBase, providerName: 'null' }).use, false);
assert.equal(
  decideLiveSplit({
    ...liveBase,
    env: { ...liveEnv, MP_MARKETPLACE_SPLIT_ALLOW_LIVE: 'false' },
  }).reason,
  'allow_live_off',
);
assert.equal(
  decideLiveSplit({
    ...liveBase,
    env: { ...liveEnv, MP_MARKETPLACE_SPLIT_ENABLED: 'false' },
  }).reason,
  'flag_off',
);
assert.equal(
  decideLiveSplit({
    ...liveBase,
    env: {
      APP_ENV: 'production',
      NODE_ENV: 'production',
      MP_MARKETPLACE_SPLIT_ENABLED: 'true',
      MP_MARKETPLACE_SPLIT_ALLOW_LIVE: 'false',
      MERCADO_PAGO_ACCESS_TOKEN: 'APP_USR-platform-live',
    },
  }).reason,
  'allow_live_off',
);

const pixCharge = pixIntentChargeAmount(100, null);
assert.equal(pixCharge, 95);
const pixFee = decideLiveSplit({ ...liveBase, chargeAmount: pixCharge });
assert.equal(pixFee.use, true);
if (pixFee.use) {
  assert.equal(pixFee.applicationFee, commissionAmount(95, 10));
  assert.equal(pixFee.applicationFee, 9.5);
}

const unifiedLive = decideMarketplaceSplit(liveBase);
assert.equal(unifiedLive.use, true);
if (unifiedLive.use) {
  assert.equal(unifiedLive.path, 'live');
  assert.equal(unifiedLive.applicationFee, 10);
}

const unifiedSandbox = decideMarketplaceSplit({
  env: sandboxEnv,
  providerName: 'mercadopago',
  items: [{ sellerId: partner.id }],
  seller: { ...partner, mpPublicKey: 'TEST-pk-seller' },
  chargeAmount: 100,
  sellerAccessToken: 'TEST-seller',
});
assert.equal(unifiedSandbox.use, true);
if (unifiedSandbox.use) {
  assert.equal(unifiedSandbox.path, 'sandbox');
  assert.equal(unifiedSandbox.applicationFee, 10);
}

assert.equal(
  decideMarketplaceSplit({
    ...liveBase,
    env: { ...liveEnv, MP_MARKETPLACE_SPLIT_ALLOW_LIVE: 'false' },
  }).use,
  false,
  'production without ALLOW_LIVE stays fail-closed',
);
assert.equal(
  decideMarketplaceSplit({
    ...liveBase,
    env: { ...liveEnv, MP_MARKETPLACE_SPLIT_ENABLED: 'false' },
  }).use,
  false,
  'ENABLED=false never fees',
);
assert.equal(decideMarketplaceSplit({ ...liveBase, seller: house }).use, false);

const livePreview = customerMarketplaceSplitPreview({
  env: liveEnv,
  items: [{ sellerId: partner.id }],
  seller: partner,
});
assert.equal(livePreview.active, true);
assert.equal(livePreview.path, 'live');
assert.equal(livePreview.bricksPublicKey, 'APP_USR-pk-seller-live');

const sandboxPreview = customerMarketplaceSplitPreview({
  env: sandboxEnv,
  items: [{ sellerId: partner.id }],
  seller: { ...partner, mpPublicKey: 'TEST-pk-seller' },
});
assert.equal(sandboxPreview.active, true);
assert.equal(sandboxPreview.path, 'sandbox');
assert.equal(sandboxPreview.bricksPublicKey, 'TEST-pk-seller');

const failClosedPreview = customerMarketplaceSplitPreview({
  env: { ...liveEnv, MP_MARKETPLACE_SPLIT_ALLOW_LIVE: 'false' },
  items: [{ sellerId: partner.id }],
  seller: partner,
});
assert.equal(failClosedPreview.active, false);
assert.equal(failClosedPreview.bricksPublicKey, null);

console.log('mp-split-live.spec ok');
