/**
 * PIX application_fee rejection detector + ledger/split persistence helpers.
 */
import assert from 'assert';
import {
  PIX_APPLICATION_FEE_SKIP_REASON,
  PIX_UNAUTHORIZED_LIVE_CREDENTIALS_SKIP_REASON,
  commissionOptsForPayment,
  isMpApplicationFeeRejected,
  isMpUnauthorizedLiveCredentials,
  persistSplitFromRemote,
  pixFeeFallbackSkipReason,
  shouldRetryPixWithoutApplicationFee,
} from './pix-application-fee-fallback';

assert.equal(
  isMpApplicationFeeRejected({
    message: 'You cannot use application_fee with this payment.',
    payload: { message: 'You cannot use application_fee with this payment.', error: 'bad_request' },
  }),
  true,
);
assert.equal(
  isMpApplicationFeeRejected({
    message: 'Mercado Pago HTTP 400',
    payload: {
      cause: [{ description: 'You cannot use application_fee with this payment.' }],
    },
  }),
  true,
);
assert.equal(
  isMpApplicationFeeRejected({ message: 'application_fee não pode ser usada neste pagamento' }),
  true,
);
assert.equal(isMpApplicationFeeRejected({ message: 'card token invalid' }), false);
assert.equal(isMpApplicationFeeRejected({ message: 'application_fee is 9.50' }), false);
assert.equal(isMpApplicationFeeRejected(null), false);

assert.equal(
  isMpUnauthorizedLiveCredentials({ message: 'Unauthorized use of live credentials' }),
  true,
);
assert.equal(
  isMpUnauthorizedLiveCredentials({
    message: 'Mercado Pago HTTP 401',
    payload: { message: 'Unauthorised use of live credential', error: 'unauthorized' },
  }),
  true,
);
assert.equal(
  isMpUnauthorizedLiveCredentials({
    payload: { cause: [{ description: 'uso não autorizado de credenciais live' }] },
  }),
  true,
);
assert.equal(isMpUnauthorizedLiveCredentials({ message: 'Unauthorized' }), false);
assert.equal(isMpUnauthorizedLiveCredentials({ message: 'invalid credentials' }), false);
assert.equal(isMpUnauthorizedLiveCredentials(null), false);
assert.equal(
  pixFeeFallbackSkipReason({ message: 'Unauthorized use of live credentials' }),
  PIX_UNAUTHORIZED_LIVE_CREDENTIALS_SKIP_REASON,
);

const sandboxEnv: NodeJS.ProcessEnv = {
  APP_ENV: 'staging',
  NODE_ENV: 'production',
  MP_MARKETPLACE_SPLIT_ENABLED: 'true',
  MP_MARKETPLACE_SPLIT_ALLOW_LIVE: 'false',
  MERCADO_PAGO_ACCESS_TOKEN: 'APP_USR-platform-test',
};
const feeErr = { message: 'You cannot use application_fee with this payment.' };
assert.equal(
  shouldRetryPixWithoutApplicationFee({
    method: 'pix',
    usedSandboxSplit: true,
    err: feeErr,
    env: sandboxEnv,
  }),
  true,
);
assert.equal(
  shouldRetryPixWithoutApplicationFee({
    method: 'card',
    usedSandboxSplit: true,
    err: feeErr,
    env: sandboxEnv,
  }),
  false,
  'card must not retry without fee',
);
assert.equal(
  shouldRetryPixWithoutApplicationFee({
    method: 'pix',
    usedSandboxSplit: false,
    err: feeErr,
    env: sandboxEnv,
  }),
  false,
);
const liveCredErr = { message: 'Unauthorized use of live credentials' };
assert.equal(
  shouldRetryPixWithoutApplicationFee({
    method: 'pix',
    usedSandboxSplit: true,
    err: liveCredErr,
    env: sandboxEnv,
  }),
  true,
  'staging PIX+fee must retry on unauthorized live credentials',
);
assert.equal(
  shouldRetryPixWithoutApplicationFee({
    method: 'card',
    usedSandboxSplit: true,
    err: liveCredErr,
    env: sandboxEnv,
  }),
  false,
);
assert.equal(
  shouldRetryPixWithoutApplicationFee({
    method: 'pix',
    usedSandboxSplit: true,
    err: feeErr,
    env: {
      APP_ENV: 'production',
      NODE_ENV: 'production',
      MP_MARKETPLACE_SPLIT_ENABLED: 'true',
      MP_MARKETPLACE_SPLIT_ALLOW_LIVE: 'false',
      MERCADO_PAGO_ACCESS_TOKEN: 'APP_USR-live',
    },
  }),
  false,
  'production live APP_USR must not retry a fee path',
);
assert.equal(
  shouldRetryPixWithoutApplicationFee({
    method: 'pix',
    usedSandboxSplit: true,
    err: liveCredErr,
    env: {
      APP_ENV: 'production',
      NODE_ENV: 'production',
      MP_MARKETPLACE_SPLIT_ENABLED: 'true',
      MP_MARKETPLACE_SPLIT_ALLOW_LIVE: 'false',
      MERCADO_PAGO_ACCESS_TOKEN: 'APP_USR-live',
    },
  }),
  false,
  'production live APP_USR must not retry unauthorized-live-credentials either',
);

const liveEnv: NodeJS.ProcessEnv = {
  APP_ENV: 'production',
  NODE_ENV: 'production',
  MP_MARKETPLACE_SPLIT_ENABLED: 'true',
  MP_MARKETPLACE_SPLIT_ALLOW_LIVE: 'true',
  MERCADO_PAGO_ACCESS_TOKEN: 'APP_USR-live',
};
assert.equal(
  shouldRetryPixWithoutApplicationFee({
    method: 'pix',
    usedSandboxSplit: false,
    usedLiveSplit: true,
    err: feeErr,
    env: liveEnv,
  }),
  true,
  'live PIX+fee retries ledger_only when ALLOW_LIVE is on',
);
assert.equal(
  shouldRetryPixWithoutApplicationFee({
    method: 'pix',
    usedSandboxSplit: false,
    usedLiveSplit: true,
    err: liveCredErr,
    env: liveEnv,
  }),
  true,
  'live PIX retries ledger_only on unauthorized live credentials',
);
assert.equal(
  shouldRetryPixWithoutApplicationFee({
    method: 'card',
    usedSandboxSplit: false,
    usedLiveSplit: true,
    err: feeErr,
    env: liveEnv,
  }),
  false,
  'live card must not retry without fee',
);
assert.equal(
  shouldRetryPixWithoutApplicationFee({
    method: 'pix',
    usedSandboxSplit: false,
    usedLiveSplit: true,
    err: feeErr,
    env: { ...liveEnv, MP_MARKETPLACE_SPLIT_ALLOW_LIVE: 'false' },
  }),
  false,
  'live PIX retry stays fail-closed without ALLOW_LIVE',
);

const ledger = persistSplitFromRemote({
  decidedUse: true,
  decidedFee: 9.5,
  sellerMpUserId: '123',
  remoteSplitMode: 'ledger_only',
  remoteSkipReason: PIX_APPLICATION_FEE_SKIP_REASON,
});
assert.equal(ledger.splitMode, 'ledger_only');
assert.equal(ledger.applicationFee, 9.5);
assert.equal(ledger.collectorMpUserId, null);
assert.equal(ledger.splitFeeSkippedReason, PIX_APPLICATION_FEE_SKIP_REASON);

const oauth = persistSplitFromRemote({
  decidedUse: true,
  decidedFee: 9.5,
  sellerMpUserId: '123',
  remoteSplitMode: 'seller_oauth_v1',
});
assert.equal(oauth.splitMode, 'seller_oauth_v1');
assert.equal(oauth.collectorMpUserId, '123');
assert.equal(oauth.splitFeeSkippedReason, null);

assert.deepEqual(
  commissionOptsForPayment({
    splitMode: 'ledger_only',
    applicationFee: 9.5,
    externalId: '999',
  }),
  {
    source: 'pending_manual_or_pix_no_fee',
    mpPaymentId: '999',
    mpApplicationFee: 9.5,
  },
);
assert.equal(
  commissionOptsForPayment({ splitMode: 'seller_oauth_v1', applicationFee: 9.5 }).source,
  'mp_application_fee',
);
assert.equal(commissionOptsForPayment({ splitMode: 'off' }).source, 'manual_pix');

console.log('pix-application-fee-fallback.spec ok');
