/** Grace after reservationExpiresAt while a pending PIX/card intent still exists. */
export const PENDING_PAYMENT_EXPIRY_GRACE_MS = 2 * 60 * 60 * 1000;

/**
 * Do not cancel an awaiting_payment order while a live pending intent exists,
 * until reservationExpiresAt + grace (covers bank PIX settle + delayed webhook).
 */
export function shouldSkipReservationExpiry(opts: {
  hasPendingPayment: boolean;
  reservationExpiresAt: Date | null | undefined;
  now: Date;
  graceMs?: number;
}): boolean {
  if (!opts.hasPendingPayment) return false;
  const grace = opts.graceMs ?? PENDING_PAYMENT_EXPIRY_GRACE_MS;
  if (!opts.reservationExpiresAt) return true;
  return opts.now.getTime() < opts.reservationExpiresAt.getTime() + grace;
}
