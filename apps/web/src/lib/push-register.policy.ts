/**
 * FCM registration scheduling rules.
 * SYNC: apps/mobile/app/src/main/java/com/lojasschimitz/app/PushRegisterPolicy.kt
 *
 * Mass push only reaches tokens already upserted. These rules decide when the
 * Android app should POST again, and how to retry without logging the token.
 */

export const FCM_REGISTER_MAX_ATTEMPTS = 3;
export const FCM_REGISTER_THROTTLE_MS = 15 * 60 * 1000;
/** Delay before attempt 1, 2, 3. Attempt 1 is immediate. */
export const FCM_REGISTER_BACKOFF_MS = [0, 2_000, 4_000] as const;

export function fcmRegisterBackoffBeforeAttempt(attempt: number): number {
  if (attempt <= 1) return 0;
  const idx = Math.min(attempt - 1, FCM_REGISTER_BACKOFF_MS.length - 1);
  return FCM_REGISTER_BACKOFF_MS[idx];
}

export type FcmEnqueueInput = {
  force: boolean;
  token: string;
  lastSuccessToken: string | null;
  lastSuccessMs: number;
  nowMs: number;
  inFlightToken: string | null;
  inFlightCount: number;
};

/**
 * `force` (permission just granted, or onNewToken) bypasses throttle and the
 * in-flight guard. A blank token never posts. The same token already in flight
 * or successfully upserted inside the throttle window is skipped.
 */
export function shouldEnqueueFcmRegister(input: FcmEnqueueInput): boolean {
  const token = input.token.trim();
  if (!token) return false;
  if (input.force) return true;
  if (input.inFlightCount > 0 && input.inFlightToken === token) return false;
  if (input.lastSuccessToken !== token) return true;
  if (input.lastSuccessMs <= 0) return true;
  return input.nowMs - input.lastSuccessMs >= FCM_REGISTER_THROTTLE_MS;
}

/**
 * Log suffix only. Tokens shorter than 12 chars are omitted entirely so a
 * short or empty value can never be printed in full.
 */
export function fcmTokenLogFingerprint(token: string): string {
  const trimmed = token.trim();
  if (trimmed.length < 12) return `len=${trimmed.length}`;
  return `…${trimmed.slice(-8)} len=${trimmed.length}`;
}
