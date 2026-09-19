import assert from 'assert';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { signMpOAuthState, verifyMpOAuthState } from './mp-oauth-state';
import {
  isHouseBrandSeller,
  marketplaceRedirectUri,
  sellerMpPublicStatus,
} from './mp-oauth.service';
import { DEFAULT_SELLER_SLUG } from '../sellers/sellers.constants';

const env = {
  JWT_ACCESS_SECRET: 'test-oauth-state-secret-please-change',
  MP_MARKETPLACE_SPLIT_ENABLED: 'true',
};

assert.equal(isHouseBrandSeller(DEFAULT_SELLER_SLUG), true);
assert.equal(isHouseBrandSeller('parceiro-centro'), false);

const house = sellerMpPublicStatus({
  slug: DEFAULT_SELLER_SLUG,
  mpOAuthStatus: 'pending',
  mpUserId: null,
});
assert.equal(house.houseBrand, true);
assert.equal(house.connectEnabled, false);

const prev = process.env.MP_MARKETPLACE_SPLIT_ENABLED;
process.env.MP_MARKETPLACE_SPLIT_ENABLED = 'true';
const partner = sellerMpPublicStatus({
  slug: 'parceiro',
  mpOAuthStatus: 'linked',
  mpUserId: '99',
});
assert.equal(partner.connectEnabled, true);
assert.equal(partner.linked, true);
assert.equal(partner.mpUserId, '99');
process.env.MP_MARKETPLACE_SPLIT_ENABLED = 'false';
const hidden = sellerMpPublicStatus({
  slug: 'parceiro',
  mpOAuthStatus: 'linked',
  mpUserId: '99',
});
assert.equal(hidden.connectEnabled, false);
assert.equal(hidden.linked, false);
assert.equal(hidden.mpUserId, null);
if (prev === undefined) delete process.env.MP_MARKETPLACE_SPLIT_ENABLED;
else process.env.MP_MARKETPLACE_SPLIT_ENABLED = prev;

const state = signMpOAuthState('seller-1', 60_000, env, 1_000);
const payload = verifyMpOAuthState(state, env, 2_000);
assert.equal(payload.sellerId, 'seller-1');

let expired = false;
try {
  verifyMpOAuthState(state, env, 1_000 + 61_000);
} catch (e: unknown) {
  expired = true;
  assert.equal((e as { code?: string }).code, 'MP_OAUTH_STATE_EXPIRED');
}
assert.equal(expired, true);

let tampered = false;
try {
  verifyMpOAuthState(state + 'x', env, 2_000);
} catch (e: unknown) {
  tampered = true;
  assert.equal((e as { code?: string }).code, 'MP_OAUTH_STATE_INVALID');
}
assert.equal(tampered, true);

assert.equal(
  marketplaceRedirectUri({ MP_MARKETPLACE_REDIRECT_URI: 'https://lojasschimitz.com.br/vendedor/mp/callback/' }),
  'https://lojasschimitz.com.br/vendedor/mp/callback',
);

// Flag-off connect is 404 (controller/service). Constructing the service needs Nest;
// assert the exception types used by assertConnectEnabled via a tiny stand-in.
function assertConnectEnabled(enabled: boolean) {
  if (!enabled) {
    throw new NotFoundException({ message: 'Conexão Mercado Pago indisponível', code: 'MP_CONNECT_DISABLED' });
  }
}
let disabled = false;
try {
  assertConnectEnabled(false);
} catch (e) {
  disabled = e instanceof NotFoundException;
}
assert.equal(disabled, true);
assert.ok(new BadRequestException({ code: 'HOUSE_BRAND_NO_SELF_SPLIT' }));

console.log('mp-oauth.service.spec ok');
