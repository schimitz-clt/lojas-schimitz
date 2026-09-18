/**
 * Dev-only simulateApprove UI (NullPaymentProvider).
 *
 * Production Next builds (`NODE_ENV=production`) always disable this, even if a
 * stray NEXT_PUBLIC_ALLOW_PAYMENT_SIMULATE=true is present on Railway web.
 * The matching API flag ALLOW_NULL_PAYMENT_SIMULATE is independently fail-closed
 * in prod-like envs (see payment.provider.ts).
 *
 * NEXT_PUBLIC_NULL_WEBHOOK_SECRET must never be read in a production bundle.
 */

export type PaymentSimulateEnv = {
  NODE_ENV?: string;
  NEXT_PUBLIC_ALLOW_PAYMENT_SIMULATE?: string;
  NEXT_PUBLIC_NULL_WEBHOOK_SECRET?: string;
};

function isProductionNodeEnv(nodeEnv: string | undefined): boolean {
  return String(nodeEnv || '').toLowerCase() === 'production';
}

/** Simulate button / client webhook POST — false in every production build. */
export function isPaymentSimulateUiEnabled(env: PaymentSimulateEnv = process.env): boolean {
  if (isProductionNodeEnv(env.NODE_ENV)) return false;
  return env.NEXT_PUBLIC_ALLOW_PAYMENT_SIMULATE === 'true';
}

/**
 * Secret used only by the local simulate button. Empty in production builds so
 * webpack cannot inline a leaked Railway value.
 */
export function paymentSimulateWebhookSecret(env: PaymentSimulateEnv = process.env): string {
  if (isProductionNodeEnv(env.NODE_ENV)) return '';
  if (!isPaymentSimulateUiEnabled(env)) return '';
  return String(env.NEXT_PUBLIC_NULL_WEBHOOK_SECRET || '');
}
