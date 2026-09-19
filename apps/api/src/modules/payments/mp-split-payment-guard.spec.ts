import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  MP_SPLIT_PAYMENT_BODY_KEYS,
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
  'PIX fee rejection retries only through the sandbox-gated helper',
);
assert.ok(
  providerSrc.includes('ledger_only'),
  'fee-rejected PIX persists an honest ledger_only splitMode',
);

const serviceSrc = readFileSync(join(__dirname, 'payments.service.ts'), 'utf8');
assert.ok(serviceSrc.includes('decideSandboxSplit'), 'payments path uses Phase 2 sandbox gate');
assert.ok(
  serviceSrc.includes('MP_MARKETPLACE_SPLIT') === false || serviceSrc.includes('decideSandboxSplit'),
  'split decision is centralized',
);

console.log('mp-split-payment-guard.spec ok');
