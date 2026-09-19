/**
 * PIX + application_fee fallback (staging / Phase 2 sandbox only).
 *
 * Mercado Pago may reject seller-token + application_fee on PIX with:
 *   - "You cannot use application_fee with this payment." (Checkout Pro /
 *     PIX fee unsupported)
 *   - "Unauthorized use of live credentials" (APP_USR test-account tokens
 *     treated as live on the fee/split path)
 * We retry once without the fee on the platform collector and keep commission
 * on the ledger. Production live APP_USR never takes this path.
 */

import { isSandboxSplitMoneyPathAllowed } from '../marketplace-mp/mp-split-sandbox';

export const PIX_APPLICATION_FEE_SKIP_REASON = 'mp_pix_application_fee_rejected' as const;
export const PIX_UNAUTHORIZED_LIVE_CREDENTIALS_SKIP_REASON =
  'mp_unauthorized_live_credentials' as const;

export type PaymentSplitModeValue = 'off' | 'seller_oauth_v1' | 'ledger_only';

export type CommissionSourceValue =
  | 'manual_pix'
  | 'mp_application_fee'
  | 'pending_manual_or_pix_no_fee';

export function isMpApplicationFeeRejected(err: unknown): boolean {
  const blob = errorBlob(err);
  if (!blob.includes('application_fee')) return false;
  return (
    blob.includes('cannot use') ||
    blob.includes('can not use') ||
    blob.includes('not allowed') ||
    blob.includes('not supported') ||
    blob.includes('unsupported') ||
    blob.includes('não é possível') ||
    blob.includes('nao e possivel') ||
    blob.includes('não pode') ||
    blob.includes('nao pode')
  );
}

/**
 * MP treats some APP_USR test-account tokens as live when application_fee
 * is present. Require live + credential so a bare 401 "Unauthorized" does not retry.
 */
export function isMpUnauthorizedLiveCredentials(err: unknown): boolean {
  const blob = errorBlob(err);
  if (!blob) return false;
  const unauthorized =
    blob.includes('unauthorized') ||
    blob.includes('unauthorised') ||
    blob.includes('não autorizad') ||
    blob.includes('nao autorizad');
  const live = blob.includes('live') || blob.includes('produção') || blob.includes('producao');
  const credential = blob.includes('credential') || blob.includes('credencia');
  return unauthorized && live && credential;
}

export function isPixSandboxFeeFallbackError(err: unknown): boolean {
  return isMpApplicationFeeRejected(err) || isMpUnauthorizedLiveCredentials(err);
}

export function pixFeeFallbackSkipReason(err: unknown): string {
  if (isMpUnauthorizedLiveCredentials(err)) return PIX_UNAUTHORIZED_LIVE_CREDENTIALS_SKIP_REASON;
  return PIX_APPLICATION_FEE_SKIP_REASON;
}

function errorBlob(err: unknown): string {
  return collectErrorTexts(err).join(' ').toLowerCase();
}

function collectErrorTexts(err: unknown): string[] {
  const texts: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === 'string' && v.trim()) texts.push(v);
  };
  if (typeof err === 'string') {
    push(err);
    return texts;
  }
  if (!err || typeof err !== 'object') return texts;
  const e = err as { message?: unknown; payload?: unknown };
  push(e.message);
  const payload = e.payload;
  if (payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>;
    push(p.message);
    push(p.error);
    push(p.cause);
    if (Array.isArray(p.cause)) {
      for (const c of p.cause) {
        if (typeof c === 'string') push(c);
        else if (c && typeof c === 'object') {
          const row = c as Record<string, unknown>;
          push(row.description);
          push(row.message);
          push(row.code);
        }
      }
    }
  }
  return texts;
}

/**
 * PIX-only, sandbox money path only, after application_fee rejection
 * or unauthorized-live-credentials on the seller+fee attempt.
 */
export function shouldRetryPixWithoutApplicationFee(input: {
  method: string;
  usedSandboxSplit: boolean;
  err: unknown;
  env?: NodeJS.ProcessEnv;
}): boolean {
  if (input.method !== 'pix') return false;
  if (!input.usedSandboxSplit) return false;
  if (!isSandboxSplitMoneyPathAllowed(input.env)) return false;
  return isPixSandboxFeeFallbackError(input.err);
}

export function persistSplitFromRemote(input: {
  decidedUse: boolean;
  decidedFee: number | null;
  sellerMpUserId?: string | null;
  remoteSplitMode?: string | null;
  remoteSkipReason?: string | null;
}): {
  splitMode: PaymentSplitModeValue;
  applicationFee: number | null;
  collectorMpUserId: string | null;
  splitFeeSkippedReason: string | null;
} {
  const remote = String(input.remoteSplitMode || '');
  if (remote === 'ledger_only') {
    return {
      splitMode: 'ledger_only',
      applicationFee: input.decidedFee,
      collectorMpUserId: null,
      splitFeeSkippedReason: input.remoteSkipReason || PIX_APPLICATION_FEE_SKIP_REASON,
    };
  }
  if (remote === 'seller_oauth_v1' || (input.decidedUse && !remote)) {
    return {
      splitMode: 'seller_oauth_v1',
      applicationFee: input.decidedFee,
      collectorMpUserId: input.sellerMpUserId || null,
      splitFeeSkippedReason: null,
    };
  }
  return {
    splitMode: 'off',
    applicationFee: null,
    collectorMpUserId: null,
    splitFeeSkippedReason: null,
  };
}

export function commissionOptsForPayment(payment: {
  splitMode?: string | null;
  applicationFee?: unknown;
  externalId?: string | null;
}): {
  source: CommissionSourceValue;
  mpPaymentId?: string | null;
  mpApplicationFee?: number | null;
} {
  const fee =
    payment.applicationFee != null && Number.isFinite(Number(payment.applicationFee))
      ? Number(payment.applicationFee)
      : null;
  if (payment.splitMode === 'seller_oauth_v1' && fee != null) {
    return {
      source: 'mp_application_fee',
      mpPaymentId: payment.externalId || null,
      mpApplicationFee: fee,
    };
  }
  if (payment.splitMode === 'ledger_only') {
    return {
      source: 'pending_manual_or_pix_no_fee',
      mpPaymentId: payment.externalId || null,
      mpApplicationFee: fee,
    };
  }
  return { source: 'manual_pix' };
}
