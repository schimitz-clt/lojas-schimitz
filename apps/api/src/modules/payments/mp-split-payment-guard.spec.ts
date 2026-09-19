import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  MP_SPLIT_PAYMENT_BODY_KEYS,
  assertLiveApplicationFeeAllowed,
  assertMarketplaceApplicationFeeAllowed,
  assertNoLiveMarketplaceSplitFields,
  assertSandboxApplicationFeeAllowed,
} from './mp-split-payment-guard';

assertNoLiveMarketplaceSplitFields({
  transaction_amount: 10,
  payment_method_id: 'pix',
  external_reference: 'SCH-1',
});

for (const key of MP_SPLIT_PAYMENT_BODY_KEYS) {
  let threw = false;
  try {
    assertNoLiveMarketplaceSplitFields({ transaction_amount: 10, [key]: 1 });
  } catch (e: unknown) {
    threw = true;
    assert.ok(
      (e as { code?: string }).code === 'PHASE2_SPLIT_FORBIDDEN' ||
        (e as { code?: string }).code === 'SPLIT_FIELD_FORBIDDEN',
    );
  }
  assert.equal(threw, true, key);
}

const sandboxEnv: NodeJS.ProcessEnv = {
  APP_ENV: 'development',
  NODE_ENV: 'test',
  MP_MARKETPLACE_SPLIT_ENABLED: 'true',
  MP_MARKETPLACE_SPLIT_ALLOW_LIVE: 'false',
  MERCADO_PAGO_ACCESS_TOKEN: 'TEST-platform',
};
assertSandboxApplicationFeeAllowed({ transaction_amount: 95, application_fee: 9.5 }, sandboxEnv);

const stagingAppUsrEnv: NodeJS.ProcessEnv = {
  APP_ENV: 'staging',
  NODE_ENV: 'production',
  MP_MARKETPLACE_SPLIT_ENABLED: 'true',
  MP_MARKETPLACE_SPLIT_ALLOW_LIVE: 'false',
  MERCADO_PAGO_ACCESS_TOKEN: 'APP_USR-platform-test',
};
assertSandboxApplicationFeeAllowed(
  { transaction_amount: 95, application_fee: 9.5 },
  stagingAppUsrEnv,
);

let liveThrew = false;
try {
  assertSandboxApplicationFeeAllowed(
    { transaction_amount: 95, application_fee: 9.5 },
    {
      APP_ENV: 'production',
      NODE_ENV: 'production',
      MP_MARKETPLACE_SPLIT_ENABLED: 'true',
      MP_MARKETPLACE_SPLIT_ALLOW_LIVE: 'true',
      MERCADO_PAGO_ACCESS_TOKEN: 'APP_USR-live',
    },
  );
} catch (e: unknown) {
  liveThrew = true;
  assert.equal((e as { code?: string }).code, 'PHASE2_SPLIT_FORBIDDEN');
}
assert.equal(liveThrew, true);

let prodAppUsrThrew = false;
try {
  assertSandboxApplicationFeeAllowed(
    { transaction_amount: 95, application_fee: 9.5 },
    {
      APP_ENV: 'production',
      NODE_ENV: 'production',
      MP_MARKETPLACE_SPLIT_ENABLED: 'true',
      MP_MARKETPLACE_SPLIT_ALLOW_LIVE: 'false',
      MERCADO_PAGO_ACCESS_TOKEN: 'APP_USR-live',
    },
  );
} catch (e: unknown) {
  prodAppUsrThrew = true;
  assert.equal((e as { code?: string }).code, 'PHASE2_SPLIT_FORBIDDEN');
}
assert.equal(prodAppUsrThrew, true);

const liveEnv: NodeJS.ProcessEnv = {
  APP_ENV: 'production',
  NODE_ENV: 'production',
  MP_MARKETPLACE_SPLIT_ENABLED: 'true',
  MP_MARKETPLACE_SPLIT_ALLOW_LIVE: 'true',
  MERCADO_PAGO_ACCESS_TOKEN: 'APP_USR-live',
};
assertLiveApplicationFeeAllowed({ transaction_amount: 95, application_fee: 9.5 }, liveEnv);
assertMarketplaceApplicationFeeAllowed({ transaction_amount: 95, application_fee: 9.5 }, liveEnv);
assertMarketplaceApplicationFeeAllowed({ transaction_amount: 95, application_fee: 9.5 }, sandboxEnv);

let liveOffThrew = false;
try {
  assertLiveApplicationFeeAllowed(
    { transaction_amount: 95, application_fee: 9.5 },
    { ...liveEnv, MP_MARKETPLACE_SPLIT_ALLOW_LIVE: 'false' },
  );
} catch (e: unknown) {
  liveOffThrew = true;
  assert.equal((e as { code?: string }).code, 'LIVE_SPLIT_FORBIDDEN');
}
assert.equal(liveOffThrew, true, 'ALLOW_LIVE=false never satisfies live fee assert');

let liveEnabledOffThrew = false;
try {
  assertLiveApplicationFeeAllowed(
    { transaction_amount: 95, application_fee: 9.5 },
    { ...liveEnv, MP_MARKETPLACE_SPLIT_ENABLED: 'false' },
  );
} catch (e: unknown) {
  liveEnabledOffThrew = true;
  assert.equal((e as { code?: string }).code, 'LIVE_SPLIT_FORBIDDEN');
}
assert.equal(liveEnabledOffThrew, true, 'ENABLED=false never satisfies live fee assert');

const providerSrc = readFileSync(join(__dirname, 'payment.provider.ts'), 'utf8');
assert.ok(
  providerSrc.includes('assertNoLiveMarketplaceSplitFields'),
  'platform path must fail-closed on split fields',
);
assert.ok(
  providerSrc.includes('assertSandboxApplicationFeeAllowed'),
  'sandbox path must re-check the money gate',
);
assert.ok(
  providerSrc.includes('sellerAccessToken'),
  'provider may use seller TEST- token on sandbox path',
);
assert.ok(
  /body\.application_fee\s*=/.test(providerSrc),
  'sandbox path assigns application_fee only after gate',
);
assert.ok(
  providerSrc.includes('isSandboxEligibleCredential'),
  'seller token is classified by sandbox-eligible helper (TEST- or staging APP_USR)',
);
assert.ok(
  providerSrc.includes('shouldRetryPixWithoutApplicationFee'),
  'PIX fee rejection retries only through the gated helper',
);
assert.ok(
  providerSrc.includes('ledger_only'),
  'fee-rejected PIX persists an honest ledger_only splitMode',
);
assert.ok(
  providerSrc.includes('assertLiveApplicationFeeAllowed'),
  'live path must re-check the live money gate',
);
assert.ok(
  providerSrc.includes('isLiveSplitMoneyPathAllowed'),
  'provider consults the Phase 3 live gate',
);

const serviceSrc = readFileSync(join(__dirname, 'payments.service.ts'), 'utf8');
assert.ok(serviceSrc.includes('decideMarketplaceSplit'), 'payments path uses unified split gate');
assert.ok(
  serviceSrc.includes('MP_MARKETPLACE_SPLIT') === false || serviceSrc.includes('decideMarketplaceSplit'),
  'split decision is centralized',
);

console.log('mp-split-payment-guard.spec ok');
