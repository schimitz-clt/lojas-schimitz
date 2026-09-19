import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  MP_SPLIT_PAYMENT_BODY_KEYS,
  assertNoLiveMarketplaceSplitFields,
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
    assert.equal((e as { code?: string }).code, 'PHASE1_SPLIT_FORBIDDEN');
  }
  assert.equal(threw, true, key);
}

const providerSrc = readFileSync(join(__dirname, 'payment.provider.ts'), 'utf8');
assert.ok(
  providerSrc.includes('assertNoLiveMarketplaceSplitFields'),
  'createIntent must fail-closed on split fields',
);
assert.ok(
  !/body\.application_fee\s*=/.test(providerSrc),
  'createIntent must not assign application_fee',
);
assert.ok(
  !/Authorization:\s*`Bearer \$\{/.test(providerSrc) || providerSrc.includes('this.token()'),
  'MP payments use platform token helper',
);
assert.ok(
  !/sellerAccessToken|mpCredential|accessTokenEnc/.test(providerSrc),
  'provider must not load seller tokens',
);

const serviceSrc = readFileSync(join(__dirname, 'payments.service.ts'), 'utf8');
assert.ok(
  !/MP_MARKETPLACE_SPLIT_ALLOW_LIVE/.test(serviceSrc),
  'payments path must ignore ALLOW_LIVE in Phase 1',
);
assert.ok(
  !/MP_MARKETPLACE_SPLIT_ENABLED/.test(serviceSrc),
  'payments path must stay current when split flags are off',
);

console.log('mp-split-payment-guard.spec ok');
