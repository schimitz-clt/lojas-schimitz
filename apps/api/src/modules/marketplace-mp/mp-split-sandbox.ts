/**
 * Phase 2 sandbox split gate.
 *
 * application_fee + seller access token are used ONLY when:
 *   ENABLED + ALLOW_LIVE=false + sandbox-eligible credentials + linked non-house seller.
 *
 * Sandbox-eligible credentials:
 *   - literal TEST- prefix (always)
 *   - APP_USR from Mercado Pago "credenciais de teste" on a Phase 2 sandbox host
 *     (APP_ENV=staging / development / test — not production). MP now issues
 *     test Access Tokens and Public Keys as APP_USR-… for test_user accounts.
 *
 * Production APP_ENV / Railway production + APP_USR never takes this path —
 * even if ENABLED or ALLOW_LIVE is accidentally true. Phase 3 is the only
 * live-money gate and is not implemented here.
 */

import { isRailwayProductionEnv } from '../../common/prod-like-env';
import { commissionAmount, resolveCommissionPercent } from '../commissions/commissions.constants';
import { isHouseBrandSeller } from './mp-oauth.public';
import {
  isMarketplaceSplitAllowLive,
  isMarketplaceSplitEnabled,
} from './marketplace-mp.flags';
import { uniqueSellerIds, type CartSellerRef } from './mixed-cart';

export const HOUSE_BRAND_SLUG = 'lojas-schimitz';

export type SandboxSplitSkipReason =
  | 'flag_off'
  | 'allow_live_blocks_phase2'
  | 'production_live_credentials'
  | 'credentials_not_test'
  | 'seller_token_not_test'
  | 'house_brand'
  | 'not_linked'
  | 'mixed_or_empty'
  | 'no_seller'
  | 'provider_not_mp'
  | 'fee_invalid';

export type SandboxSplitDecision =
  | { use: false; reason: SandboxSplitSkipReason }
  | {
      use: true;
      reason: 'sandbox_seller_oauth_v1';
      applicationFee: number;
      percent: number;
    };

/** Literal TEST- prefix. Always sandbox-eligible. */
export function isMpTestCredential(token: string | null | undefined): boolean {
  return String(token || '')
    .trim()
    .startsWith('TEST-');
}

/** APP_USR- prefix. Live in production; test-account format in Phase 2 sandbox hosts. */
export function isLiveAppUsrCredential(token: string | null | undefined): boolean {
  return String(token || '')
    .trim()
    .startsWith('APP_USR');
}

export function isProductionAppEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  const app = String(env.APP_ENV || '')
    .toLowerCase()
    .trim();
  return app === 'production' || app === 'prod';
}

/**
 * True production money host. Staging is NOT included (unlike isProdLikeEnv).
 * Railway production counts even if APP_ENV is mis-set.
 */
export function isProductionLiveMoneyEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return isProductionAppEnv(env) || isRailwayProductionEnv(env);
}

/**
 * Host where Phase 2 may treat APP_USR as Mercado Pago "credenciais de teste".
 * Fail-closed: unknown / production hosts are not sandbox hosts for APP_USR.
 */
export function isPhase2SandboxHostEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  if (isProductionLiveMoneyEnv(env)) return false;
  const app = String(env.APP_ENV || '')
    .toLowerCase()
    .trim();
  if (app === 'staging' || app === 'development' || app === 'dev' || app === 'test') {
    return true;
  }
  const node = String(env.NODE_ENV || '')
    .toLowerCase()
    .trim();
  return node === 'test' || node === 'development';
}

/**
 * Credential usable on the Phase 2 sandbox money path.
 * TEST- is always eligible. APP_USR is eligible only on a sandbox host.
 */
export function isSandboxEligibleCredential(
  token: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (isMpTestCredential(token)) return true;
  return isLiveAppUsrCredential(token) && isPhase2SandboxHostEnv(env);
}

export function platformAccessToken(env: NodeJS.ProcessEnv = process.env): string {
  return String(env.MERCADO_PAGO_ACCESS_TOKEN || env.MP_ACCESS_TOKEN || '').trim();
}

/**
 * Money-path gate for Phase 2. Does not inspect seller state.
 * ALLOW_LIVE=true never unlocks charges in this phase.
 */
export function isSandboxSplitMoneyPathAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  if (!isMarketplaceSplitEnabled(env)) return false;
  if (isMarketplaceSplitAllowLive(env)) return false;
  return isSandboxEligibleCredential(platformAccessToken(env), env);
}

export type SplitSellerSnapshot = {
  id: string;
  slug: string;
  mpOAuthStatus?: string | null;
  mpUserId?: string | null;
  mpPublicKey?: string | null;
  commissionPercent?: number | null;
};

export function resolveSingleOrderSeller(
  items: CartSellerRef[],
  sellers: SplitSellerSnapshot[],
): SplitSellerSnapshot | null {
  const ids = uniqueSellerIds(items);
  if (ids.length !== 1) return null;
  return sellers.find((s) => s.id === ids[0]) || null;
}

/**
 * Decide whether this order should go through sandbox seller-token + application_fee.
 * Pure: no I/O. Caller supplies decrypted seller token only when already loaded.
 */
export function decideSandboxSplit(input: {
  env?: NodeJS.ProcessEnv;
  providerName?: string;
  items: CartSellerRef[];
  seller: SplitSellerSnapshot | null;
  chargeAmount: number;
  sellerAccessToken?: string | null;
}): SandboxSplitDecision {
  const env = input.env || process.env;
  if (input.providerName && input.providerName !== 'mercadopago') {
    return { use: false, reason: 'provider_not_mp' };
  }
  if (!isSandboxSplitMoneyPathAllowed(env)) {
    if (isMarketplaceSplitAllowLive(env) && isMarketplaceSplitEnabled(env)) {
      return { use: false, reason: 'allow_live_blocks_phase2' };
    }
    if (isProductionLiveMoneyEnv(env) && isLiveAppUsrCredential(platformAccessToken(env))) {
      return { use: false, reason: 'production_live_credentials' };
    }
    if (!isMarketplaceSplitEnabled(env)) {
      return { use: false, reason: 'flag_off' };
    }
    return { use: false, reason: 'credentials_not_test' };
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
    if (!isSandboxEligibleCredential(input.sellerAccessToken, env)) {
      return { use: false, reason: 'seller_token_not_test' };
    }
  }

  const percent = resolveCommissionPercent(seller.commissionPercent);
  const applicationFee = commissionAmount(Number(input.chargeAmount), percent);
  if (applicationFee <= 0 || applicationFee >= Number(input.chargeAmount)) {
    return { use: false, reason: 'fee_invalid' };
  }

  return {
    use: true,
    reason: 'sandbox_seller_oauth_v1',
    applicationFee,
    percent,
  };
}

/**
 * Customer-safe Brick key preview.
 * Production live APP_USR keys are never returned. Staging test-account
 * APP_USR public keys are returned when the sandbox path is active.
 */
export function customerSandboxSplitPreview(input: {
  env?: NodeJS.ProcessEnv;
  items: CartSellerRef[];
  seller: SplitSellerSnapshot | null;
}): { active: boolean; bricksPublicKey: string | null } {
  const env = input.env || process.env;
  const decision = decideSandboxSplit({
    env,
    providerName: 'mercadopago',
    items: input.items,
    seller: input.seller,
    chargeAmount: 100,
  });
  if (!decision.use) {
    return { active: false, bricksPublicKey: null };
  }
  const key = String(input.seller?.mpPublicKey || '').trim();
  if (!key || !isSandboxEligibleCredential(key, env)) {
    return { active: true, bricksPublicKey: null };
  }
  return { active: true, bricksPublicKey: key };
}
