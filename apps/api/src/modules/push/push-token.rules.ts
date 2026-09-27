/**
 * Device FCM token upsert rules — pure.
 * Possessing the token string is device ownership. Logged-in request binds userId.
 * Guest refresh must not unlink an existing user binding.
 */

export const FCM_TOKEN_MIN_LEN = 32;
export const FCM_TOKEN_MAX_LEN = 4096;

export type PushPlatformId = 'android';

export type TokenUpsertInput = {
  token: unknown;
  platform?: unknown;
  enabled?: unknown;
  appVersion?: unknown;
};

export type TokenUpsertNormalized = {
  token: string;
  platform: PushPlatformId;
  enabled: boolean;
  appVersion: string | null;
};

export type TokenUpsertError = { ok: false; code: string; message: string };
export type TokenUpsertOk = { ok: true; value: TokenUpsertNormalized };
export type TokenUpsertResult = TokenUpsertOk | TokenUpsertError;

export function normalizeFcmToken(raw: unknown): string {
  return String(raw ?? '').trim();
}

/** Printable ASCII, no whitespace. FCM tokens use `:` and URL-safe chars. */
export function isValidFcmToken(token: string): boolean {
  if (token.length < FCM_TOKEN_MIN_LEN || token.length > FCM_TOKEN_MAX_LEN) return false;
  if (/\s/.test(token)) return false;
  return /^[\x21-\x7E]+$/.test(token);
}

export function normalizePushPlatform(raw: unknown): PushPlatformId | null {
  const s = String(raw ?? 'android').trim().toLowerCase();
  if (!s || s === 'android') return 'android';
  return null;
}

function parseEnabled(raw: unknown): boolean {
  if (raw === false || raw === 0 || raw === '0' || raw === 'false') return false;
  return true;
}

export function validateTokenUpsert(input: TokenUpsertInput): TokenUpsertResult {
  const token = normalizeFcmToken(input.token);
  if (!isValidFcmToken(token)) {
    return {
      ok: false,
      code: 'PUSH_TOKEN_INVALID',
      message: 'Token FCM inválido',
    };
  }
  const platform = normalizePushPlatform(input.platform);
  if (!platform) {
    return {
      ok: false,
      code: 'PUSH_PLATFORM_UNSUPPORTED',
      message: 'Plataforma não suportada (v1: android)',
    };
  }
  const appVersionRaw = String(input.appVersion ?? '').trim();
  const appVersion = appVersionRaw ? appVersionRaw.slice(0, 40) : null;
  return {
    ok: true,
    value: {
      token,
      platform,
      enabled: parseEnabled(input.enabled),
      appVersion,
    },
  };
}

/**
 * Bind userId on upsert:
 * - Authenticated request always takes ownership (device reused / login).
 * - Guest request keeps an existing userId (do not unlink on anonymous refresh).
 * - New guest token stays null.
 */
export function resolveTokenUserId(opts: {
  existingUserId: string | null | undefined;
  requestUserId: string | null | undefined;
}): string | null {
  const req = typeof opts.requestUserId === 'string' ? opts.requestUserId.trim() : '';
  if (req) return req;
  const existing = typeof opts.existingUserId === 'string' ? opts.existingUserId.trim() : '';
  return existing || null;
}

/** Last 12 chars only — never persist/log the full FCM token in dispatch history. */
export function fcmTokenFingerprint(token: string): string {
  const t = normalizeFcmToken(token);
  if (t.length <= 12) return t;
  return t.slice(-12);
}

/**
 * FCM error codes that mean "this token is permanently dead" (app uninstalled, data cleared,
 * token rotated, or never valid). The device will get a new token; this one must not be retried.
 * firebase-admin maps the FCM v1 `UNREGISTERED` status to `messaging/registration-token-not-registered`.
 */
export const FCM_UNREGISTER_ERROR_CODES = [
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/unregistered',
] as const;

/**
 * `messaging/invalid-argument` is ambiguous: FCM uses it for a malformed token AND for a bad
 * message (e.g. invalid image URL, payload too big). In the second case EVERY token in the send
 * gets it, so it only counts as a dead token when the message is about the registration token.
 */
export const FCM_INVALID_ARGUMENT_CODE = 'messaging/invalid-argument';
const TOKEN_ARGUMENT_MESSAGE_RE = /registration[ -]?token/i;

/** Retry-worthy / not the token's fault — never deactivate on these. */
export const FCM_TRANSIENT_ERROR_CODES = [
  'messaging/unavailable',
  'messaging/server-unavailable',
  'messaging/internal-error',
  'messaging/quota-exceeded',
  'messaging/message-rate-exceeded',
  'messaging/device-message-rate-exceeded',
  'messaging/topics-message-rate-exceeded',
  'messaging/mismatched-credential',
  'messaging/third-party-auth-error',
  'messaging/invalid-credential',
  'messaging/authentication-error',
  'app/invalid-credential',
  'app/network-error',
  'send_error',
  'unavailable',
  'internal',
] as const;

export type FcmErrorKind = 'invalid_token' | 'payload' | 'transient' | 'unknown';

export function classifyFcmError(
  errorCode: string | null | undefined,
  errorMessage?: string | null,
): FcmErrorKind {
  const c = String(errorCode || '').trim().toLowerCase();
  if (!c) return 'unknown';
  if ((FCM_UNREGISTER_ERROR_CODES as readonly string[]).includes(c) || c.includes('not-registered')) {
    return 'invalid_token';
  }
  if (c === FCM_INVALID_ARGUMENT_CODE) {
    return TOKEN_ARGUMENT_MESSAGE_RE.test(String(errorMessage || '')) ? 'invalid_token' : 'payload';
  }
  if ((FCM_TRANSIENT_ERROR_CODES as readonly string[]).includes(c)) return 'transient';
  return 'unknown';
}

/** Only a permanent, token-specific error deactivates. Transient/payload/unknown keep the token. */
export function shouldDisableInvalidFcmToken(
  errorCode: string | null | undefined,
  errorMessage?: string | null,
): boolean {
  return classifyFcmError(errorCode, errorMessage) === 'invalid_token';
}

/**
 * Safety net: if most of a large send comes back "dead", it is far more likely a
 * config/project problem than real uninstalls — deactivate nothing and alert instead.
 * Batches smaller than `minBatch` (single-device sends) are never blocked.
 */
export const MASS_INVALIDATION_MIN_BATCH = 10;
export const MASS_INVALIDATION_MAX_SHARE = 0.5;

export function isMassInvalidation(
  batchSize: number,
  disableCount: number,
  opts: { minBatch?: number; maxShare?: number } = {},
): boolean {
  const minBatch = opts.minBatch ?? MASS_INVALIDATION_MIN_BATCH;
  const maxShare = opts.maxShare ?? MASS_INVALIDATION_MAX_SHARE;
  if (batchSize < minBatch || disableCount <= 0) return false;
  return disableCount / batchSize > maxShare;
}
