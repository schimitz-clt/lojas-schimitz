import assert from 'assert';
import { commissionAmount } from '../commissions/commissions.constants';
import { pixIntentChargeAmount } from '../../common/pricing';
import {
  customerSandboxSplitPreview,
  decideSandboxSplit,
  isLiveAppUsrCredential,
  isMpTestCredential,
  isPhase2SandboxHostEnv,
  isProductionAppEnv,
  isProductionLiveMoneyEnv,
  isSandboxEligibleCredential,
  isSandboxSplitMoneyPathAllowed,
} from './mp-split-sandbox';

const partner = {
  id: 'seller-p',
  slug: 'parceiro',
  mpOAuthStatus: 'linked' as const,
  mpUserId: '123',
  mpPublicKey: 'TEST-pk-seller',
  commissionPercent: 10,
};
const house = {
  id: 'seller-h',
  slug: 'lojas-schimitz',
  mpOAuthStatus: 'linked' as const,
  mpUserId: '1',
  mpPublicKey: 'TEST-pk-house',
  commissionPercent: 10,
};

assert.equal(isMpTestCredential('TEST-abc'), true);
assert.equal(isMpTestCredential('APP_USR-abc'), false);
assert.equal(isLiveAppUsrCredential('APP_USR-abc'), true);
assert.equal(isProductionAppEnv({ APP_ENV: 'production' }), true);
assert.equal(isProductionAppEnv({ APP_ENV: 'staging' }), false);
assert.equal(isProductionLiveMoneyEnv({ APP_ENV: 'production' }), true);
assert.equal(isProductionLiveMoneyEnv({ APP_ENV: 'staging' }), false);
assert.equal(isProductionLiveMoneyEnv({ RAILWAY_ENVIRONMENT: 'production' }), true);
assert.equal(isPhase2SandboxHostEnv({ APP_ENV: 'staging', NODE_ENV: 'production' }), true);
assert.equal(isPhase2SandboxHostEnv({ APP_ENV: 'development' }), true);
assert.equal(isPhase2SandboxHostEnv({ APP_ENV: 'production' }), false);
assert.equal(isPhase2SandboxHostEnv({ RAILWAY_ENVIRONMENT: 'production', APP_ENV: 'staging' }), false);

assert.equal(isSandboxEligibleCredential('TEST-abc', { APP_ENV: 'production' }), true);
assert.equal(isSandboxEligibleCredential('APP_USR-abc', { APP_ENV: 'staging' }), true);
assert.equal(isSandboxEligibleCredential('APP_USR-abc', { APP_ENV: 'development' }), true);
assert.equal(isSandboxEligibleCredential('APP_USR-abc', { APP_ENV: 'production' }), false);
assert.equal(
  isSandboxEligibleCredential('APP_USR-abc', { RAILWAY_ENVIRONMENT: 'production' }),
  false,
);

const sandboxEnv: NodeJS.ProcessEnv = {
  APP_ENV: 'development',
  NODE_ENV: 'development',
  MP_MARKETPLACE_SPLIT_ENABLED: 'true',
  MP_MARKETPLACE_SPLIT_ALLOW_LIVE: 'false',
  MERCADO_PAGO_ACCESS_TOKEN: 'TEST-platform',
};

const stagingAppUsrEnv: NodeJS.ProcessEnv = {
  APP_ENV: 'staging',
  NODE_ENV: 'production',
  MP_MARKETPLACE_SPLIT_ENABLED: 'true',
  MP_MARKETPLACE_SPLIT_ALLOW_LIVE: 'false',
  MERCADO_PAGO_ACCESS_TOKEN: 'APP_USR-platform-test',
};

assert.equal(isSandboxSplitMoneyPathAllowed(sandboxEnv), true);
assert.equal(isSandboxSplitMoneyPathAllowed(stagingAppUsrEnv), true);
assert.equal(
  isSandboxSplitMoneyPathAllowed({ ...sandboxEnv, MP_MARKETPLACE_SPLIT_ENABLED: 'false' }),
  false,
);
assert.equal(
  isSandboxSplitMoneyPathAllowed({ ...sandboxEnv, MP_MARKETPLACE_SPLIT_ALLOW_LIVE: 'true' }),
  false,
);
assert.equal(
  isSandboxSplitMoneyPathAllowed({
    ...stagingAppUsrEnv,
    MP_MARKETPLACE_SPLIT_ALLOW_LIVE: 'true',
  }),
  false,
);
assert.equal(
  isSandboxSplitMoneyPathAllowed({
    ...sandboxEnv,
    APP_ENV: 'production',
    NODE_ENV: 'production',
    MERCADO_PAGO_ACCESS_TOKEN: 'APP_USR-live',
  }),
  false,
);
assert.equal(
  isSandboxSplitMoneyPathAllowed({
    ...sandboxEnv,
    APP_ENV: 'production',
    NODE_ENV: 'production',
    MERCADO_PAGO_ACCESS_TOKEN: 'TEST-platform',
  }),
  true,
);
assert.equal(
  isSandboxSplitMoneyPathAllowed({
    ...stagingAppUsrEnv,
    RAILWAY_ENVIRONMENT: 'production',
  }),
  false,
);

const base = {
  env: sandboxEnv,
  providerName: 'mercadopago',
  items: [{ sellerId: partner.id }],
  seller: partner,
  chargeAmount: 100,
  sellerAccessToken: 'TEST-seller',
};

const ok = decideSandboxSplit(base);
assert.equal(ok.use, true);
if (ok.use) {
  assert.equal(ok.applicationFee, 10);
  assert.equal(ok.percent, 10);
}

assert.equal(decideSandboxSplit({ ...base, seller: house }).use, false);
assert.equal(decideSandboxSplit({ ...base, seller: { ...partner, mpOAuthStatus: 'pending' } }).use, false);
assert.equal(decideSandboxSplit({ ...base, items: [] }).use, false);
assert.equal(
  decideSandboxSplit({
    ...base,
    items: [{ sellerId: partner.id }, { sellerId: house.id }],
  }).use,
  false,
);
assert.equal(decideSandboxSplit({ ...base, sellerAccessToken: 'APP_USR-seller' }).use, true);
assert.equal(decideSandboxSplit({ ...base, providerName: 'null' }).use, false);

const stagingBase = {
  ...base,
  env: stagingAppUsrEnv,
  sellerAccessToken: 'APP_USR-seller-test',
  seller: { ...partner, mpPublicKey: 'APP_USR-pk-seller-test' },
};
const stagingOk = decideSandboxSplit(stagingBase);
assert.equal(stagingOk.use, true);
if (stagingOk.use) {
  assert.equal(stagingOk.applicationFee, 10);
}
assert.equal(
  decideSandboxSplit({
    ...base,
    env: { ...sandboxEnv, MP_MARKETPLACE_SPLIT_ALLOW_LIVE: 'true' },
  }).reason,
  'allow_live_blocks_phase2',
);
assert.equal(
  decideSandboxSplit({
    ...base,
    env: {
      ...sandboxEnv,
      APP_ENV: 'production',
      NODE_ENV: 'production',
      MERCADO_PAGO_ACCESS_TOKEN: 'APP_USR-live',
    },
  }).reason,
  'production_live_credentials',
);
assert.equal(
  decideSandboxSplit({
    ...base,
    env: {
      ...sandboxEnv,
      APP_ENV: 'production',
      NODE_ENV: 'production',
      MERCADO_PAGO_ACCESS_TOKEN: 'TEST-platform',
    },
    sellerAccessToken: 'APP_USR-seller',
  }).reason,
  'seller_token_not_test',
);

const pixCharge = pixIntentChargeAmount(100, null);
assert.equal(pixCharge, 95);
const pixFee = decideSandboxSplit({ ...base, chargeAmount: pixCharge });
assert.equal(pixFee.use, true);
if (pixFee.use) {
  assert.equal(pixFee.applicationFee, commissionAmount(95, 10));
  assert.equal(pixFee.applicationFee, 9.5);
}

const preview = customerSandboxSplitPreview({
  env: sandboxEnv,
  items: [{ sellerId: partner.id }],
  seller: partner,
});
assert.equal(preview.active, true);
assert.equal(preview.bricksPublicKey, 'TEST-pk-seller');

const livePreview = customerSandboxSplitPreview({
  env: {
    APP_ENV: 'production',
    NODE_ENV: 'production',
    MP_MARKETPLACE_SPLIT_ENABLED: 'true',
    MERCADO_PAGO_ACCESS_TOKEN: 'APP_USR-live',
  },
  items: [{ sellerId: partner.id }],
  seller: partner,
});
assert.equal(livePreview.active, false);
assert.equal(livePreview.bricksPublicKey, null);

const stagingPreview = customerSandboxSplitPreview({
  env: stagingAppUsrEnv,
  items: [{ sellerId: partner.id }],
  seller: { ...partner, mpPublicKey: 'APP_USR-pk-seller-test' },
});
assert.equal(stagingPreview.active, true);
assert.equal(stagingPreview.bricksPublicKey, 'APP_USR-pk-seller-test');

console.log('mp-split-sandbox.spec ok');
