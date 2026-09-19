/**
 * Phase 2: Payments API body may carry application_fee only on the sandbox path.
 * marketplace_fee / collector_id / sponsor_id / disbursements stay forbidden.
 * Production APP_USR + ALLOW_LIVE never unlocks a charge path in this PR.
 */

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
      'application_fee só é permitido no caminho sandbox (TEST- + ENABLED + ALLOW_LIVE=false).',
    );
    err.code = 'PHASE2_SPLIT_FORBIDDEN';
    throw err;
  }
}

/**
 * When application_fee is present, the Phase 2 sandbox money-path must be open.
 * ALLOW_LIVE / production APP_USR never satisfies this.
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
      'application_fee bloqueado: sandbox split só com ENABLED + ALLOW_LIVE=false + credenciais TEST-.',
    );
    err.code = 'PHASE2_SPLIT_FORBIDDEN';
    throw err;
  }
}
