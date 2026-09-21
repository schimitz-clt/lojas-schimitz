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

export const FCM_UNREGISTER_ERROR_CODES = [
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
] as const;

export function shouldDisableInvalidFcmToken(errorCode: string | null | undefined): boolean {
  const c = String(errorCode || '').trim().toLowerCase();
  if (!c) return false;
  return (FCM_UNREGISTER_ERROR_CODES as readonly string[]).includes(c) || c.includes('not-registered');
}
