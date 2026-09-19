/**
 * Phase 3 live marketplace split gate.
 *
 * Seller access token + application_fee are used on the live money path ONLY when
 * ALL of the following hold:
 *   - MP_MARKETPLACE_SPLIT_ENABLED=true
 *   - MP_MARKETPLACE_SPLIT_ALLOW_LIVE=true
 *   - production or prod-like host
 *   - platform + seller credentials are live APP_USR (TEST- is never enough)
 *   - seller linked, non-house, single-seller cart
 *
 * The Phase 2 sandbox path (ALLOW_LIVE=false + test credentials) is unchanged
 * and is decided first by decideSandboxSplit.
 */

import { isProdLikeEnv } from '../../common/prod-like-env';
import { commissionAmount, resolveCommissionPercent } from '../commissions/commissions.constants';
import { isHouseBrandSeller } from './mp-oauth.public';
import {
  isMarketplaceSplitAllowLive,
  isMarketplaceSplitEnabled,
} from './marketplace-mp.flags';
import { uniqueSellerIds, type CartSellerRef } from './mixed-cart';
import {
  decideSandboxSplit,
  isLiveAppUsrCredential,
  isMpTestCredential,
  isProductionLiveMoneyEnv,
  isSandboxEligibleCredential,
  platformAccessToken,
  type SandboxSplitDecision,
  type SplitSellerSnapshot,
} from './mp-split-sandbox';

export type LiveSplitSkipReason =
  | 'flag_off'
  | 'allow_live_off'
  | 'not_prod_like'
  | 'credentials_not_live'
  | 'seller_token_not_live'
  | 'house_brand'
  | 'not_linked'
  | 'mixed_or_empty'
  | 'no_seller'
  | 'provider_not_mp'
  | 'fee_invalid';

export type LiveSplitDecision =
  | { use: false; reason: LiveSplitSkipReason }
  | {
      use: true;
      reason: 'live_seller_oauth_v1';
      applicationFee: number;
      percent: number;
    };

export type MarketplaceSplitDecision =
  | { use: false; path: 'none'; reason: string }
  | {
      use: true;
      path: 'sandbox' | 'live';
      reason: string;
      applicationFee: number;
      percent: number;
    };

/** Production / Railway production, or any prod-like host (staging included). */
export function isLiveSplitHostEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return isProductionLiveMoneyEnv(env) || isProdLikeEnv(env);
}

/**
 * Money-path gate for Phase 3. Does not inspect seller state.
 * ALLOW_LIVE=false never unlocks this path.
 */
export function isLiveSplitMoneyPathAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  if (!isMarketplaceSplitEnabled(env)) return false;
  if (!isMarketplaceSplitAllowLive(env)) return false;
  if (!isLiveSplitHostEnv(env)) return false;
  const token = platformAccessToken(env);
  if (!isLiveAppUsrCredential(token)) return false;
  if (isMpTestCredential(token)) return false;
  return true;
}

/**
 * Decide whether this order should go through live seller-token + application_fee.
 * Pure: no I/O. Caller supplies decrypted seller token only when already loaded.
 */
export function decideLiveSplit(input: {
  env?: NodeJS.ProcessEnv;
  providerName?: string;
  items: CartSellerRef[];
  seller: SplitSellerSnapshot | null;
  chargeAmount: number;
  sellerAccessToken?: string | null;
}): LiveSplitDecision {
  const env = input.env || process.env;
  if (input.providerName && input.providerName !== 'mercadopago') {
    return { use: false, reason: 'provider_not_mp' };
  }
  if (!isLiveSplitMoneyPathAllowed(env)) {
    if (!isMarketplaceSplitEnabled(env)) return { use: false, reason: 'flag_off' };
    if (!isMarketplaceSplitAllowLive(env)) return { use: false, reason: 'allow_live_off' };
    if (!isLiveSplitHostEnv(env)) return { use: false, reason: 'not_prod_like' };
    return { use: false, reason: 'credentials_not_live' };
  }

  const ids = uniqueSellerIds(input.items);
  if (ids.length !== 1) {
    return { use: false, reason: 'mixed_or_empty' };
  }
  const seller = input.seller;
  if (!seller) {
    return { use: false, reason: 'no_seller' };
  }
  if (isHouseBrandSeller(seller.slug)) {
    return { use: false, reason: 'house_brand' };
  }
  if (seller.mpOAuthStatus !== 'linked' || !seller.mpUserId) {
    return { use: false, reason: 'not_linked' };
  }

  if (input.sellerAccessToken != null) {
    if (!isLiveAppUsrCredential(input.sellerAccessToken) || isMpTestCredential(input.sellerAccessToken)) {
      return { use: false, reason: 'seller_token_not_live' };
    }
  }

  const percent = resolveCommissionPercent(seller.commissionPercent);
  const applicationFee = commissionAmount(Number(input.chargeAmount), percent);
  if (applicationFee <= 0 || applicationFee >= Number(input.chargeAmount)) {
    return { use: false, reason: 'fee_invalid' };
  }

  return {
    use: true,
    reason: 'live_seller_oauth_v1',
    applicationFee,
    percent,
  };
}

function skipReasonFromSandboxAndLive(
  sandbox: SandboxSplitDecision,
  live: LiveSplitDecision,
  env: NodeJS.ProcessEnv,
): string {
  if (isMarketplaceSplitAllowLive(env) && isMarketplaceSplitEnabled(env)) {
    return live.reason;
  }
  return sandbox.reason;
}

/**
 * Unified split decision: sandbox first (unchanged Phase 2), then live Phase 3.
 * The two money paths are mutually exclusive via ALLOW_LIVE.
 */
export function decideMarketplaceSplit(input: {
  env?: NodeJS.ProcessEnv;
  providerName?: string;
  items: CartSellerRef[];
  seller: SplitSellerSnapshot | null;
  chargeAmount: number;
  sellerAccessToken?: string | null;
}): MarketplaceSplitDecision {
  const env = input.env || process.env;
  const sandbox = decideSandboxSplit({ ...input, env });
  if (sandbox.use) {
    return {
      use: true,
      path: 'sandbox',
      reason: sandbox.reason,
      applicationFee: sandbox.applicationFee,
      percent: sandbox.percent,
    };
  }
  const live = decideLiveSplit({ ...input, env });
  if (live.use) {
    return {
      use: true,
      path: 'live',
      reason: live.reason,
      applicationFee: live.applicationFee,
      percent: live.percent,
    };
  }
  return {
    use: false,
    path: 'none',
    reason: skipReasonFromSandboxAndLive(sandbox, live, env),
  };
}

/** Customer-safe Brick key for sandbox or live seller collector. */
export function customerMarketplaceSplitPreview(input: {
  env?: NodeJS.ProcessEnv;
  items: CartSellerRef[];
  seller: SplitSellerSnapshot | null;
}): { active: boolean; bricksPublicKey: string | null; path: 'none' | 'sandbox' | 'live' } {
  const env = input.env || process.env;
  const decision = decideMarketplaceSplit({
    env,
    providerName: 'mercadopago',
    items: input.items,
    seller: input.seller,
    chargeAmount: 100,
  });
  if (!decision.use) {
    return { active: false, bricksPublicKey: null, path: 'none' };
  }
  const key = String(input.seller?.mpPublicKey || '').trim();
  if (decision.path === 'sandbox') {
    if (!key || !isSandboxEligibleCredential(key, env)) {
      return { active: true, bricksPublicKey: null, path: 'sandbox' };
    }
    return { active: true, bricksPublicKey: key, path: 'sandbox' };
  }
  if (!key || !isLiveAppUsrCredential(key) || isMpTestCredential(key)) {
    return { active: true, bricksPublicKey: null, path: 'live' };
  }
  return { active: true, bricksPublicKey: key, path: 'live' };
}
