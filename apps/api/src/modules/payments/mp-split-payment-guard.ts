/**
 * Payments API body may carry application_fee only on a gated money path:
 *   - Phase 2 sandbox: ENABLED + ALLOW_LIVE=false + test credentials
 *   - Phase 3 live: ENABLED + ALLOW_LIVE=true + prod-like + live APP_USR
 * marketplace_fee / collector_id / sponsor_id / disbursements stay forbidden.
 */

import { isLiveSplitMoneyPathAllowed } from '../marketplace-mp/mp-split-live';
import { isSandboxSplitMoneyPathAllowed } from '../marketplace-mp/mp-split-sandbox';

export const MP_SPLIT_UNSUPPORTED_BODY_KEYS = [
  'marketplace_fee',
  'collector_id',
  'sponsor_id',
  'disbursements',
] as const;

export const MP_SPLIT_PAYMENT_BODY_KEYS = [
  'application_fee',
  ...MP_SPLIT_UNSUPPORTED_BODY_KEYS,
] as const;

export function assertNoUnsupportedMarketplaceSplitFields(body: Record<string, unknown>): void {
  for (const key of MP_SPLIT_UNSUPPORTED_BODY_KEYS) {
    if (Object.prototype.hasOwnProperty.call(body, key) && body[key] != null) {
      const err: Error & { code?: string } = new Error(
        'Campo de split não suportado no Payments API (marketplace_fee / collector_id / sponsor_id / disbursements).',
      );
      err.code = 'SPLIT_FIELD_FORBIDDEN';
      throw err;
    }
  }
}

/** Platform-collector path: no application_fee either. */
export function assertNoLiveMarketplaceSplitFields(body: Record<string, unknown>): void {
  assertNoUnsupportedMarketplaceSplitFields(body);
  if (Object.prototype.hasOwnProperty.call(body, 'application_fee') && body.application_fee != null) {
    const err: Error & { code?: string } = new Error(
      'application_fee só é permitido no caminho sandbox ou live (gates ENABLED / ALLOW_LIVE / credenciais).',
    );
    err.code = 'PHASE2_SPLIT_FORBIDDEN';
    throw err;
  }
}

/**
 * When application_fee is present, the Phase 2 sandbox money-path must be open.
 * ALLOW_LIVE / production live APP_USR never satisfies this (use assertLiveApplicationFeeAllowed).
 */
export function assertSandboxApplicationFeeAllowed(
  body: Record<string, unknown>,
  env: NodeJS.ProcessEnv = process.env,
): void {
  assertNoUnsupportedMarketplaceSplitFields(body);
  if (!Object.prototype.hasOwnProperty.call(body, 'application_fee') || body.application_fee == null) {
    return;
  }
  if (!isSandboxSplitMoneyPathAllowed(env)) {
    const err: Error & { code?: string } = new Error(
      'application_fee bloqueado: sandbox split só com ENABLED + ALLOW_LIVE=false + credenciais de teste (TEST- ou APP_USR de staging).',
    );
    err.code = 'PHASE2_SPLIT_FORBIDDEN';
    throw err;
  }
}

/**
 * When application_fee is present on the Phase 3 live path, every live gate must be open.
 */
export function assertLiveApplicationFeeAllowed(
  body: Record<string, unknown>,
  env: NodeJS.ProcessEnv = process.env,
): void {
  assertNoUnsupportedMarketplaceSplitFields(body);
  if (!Object.prototype.hasOwnProperty.call(body, 'application_fee') || body.application_fee == null) {
    return;
  }
  if (!isLiveSplitMoneyPathAllowed(env)) {
    const err: Error & { code?: string } = new Error(
      'application_fee bloqueado: split live só com ENABLED + ALLOW_LIVE=true + produção/prod-like + credenciais APP_USR.',
    );
    err.code = 'LIVE_SPLIT_FORBIDDEN';
    throw err;
  }
}

/** application_fee is allowed only when sandbox OR live money-path is open. */
export function assertMarketplaceApplicationFeeAllowed(
  body: Record<string, unknown>,
  env: NodeJS.ProcessEnv = process.env,
): void {
  assertNoUnsupportedMarketplaceSplitFields(body);
  if (!Object.prototype.hasOwnProperty.call(body, 'application_fee') || body.application_fee == null) {
    return;
  }
  if (isSandboxSplitMoneyPathAllowed(env) || isLiveSplitMoneyPathAllowed(env)) {
    return;
  }
  const err: Error & { code?: string } = new Error(
    'application_fee bloqueado: nenhum caminho de split (sandbox ou live) está aberto.',
  );
  err.code = 'PHASE2_SPLIT_FORBIDDEN';
  throw err;
}
