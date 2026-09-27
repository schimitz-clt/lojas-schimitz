/**
 * Mercado Pago notification topics that are NOT payments and must not be fetched as a payment
 * (GET /v1/payments/{merchantOrderId} → 404 → 5xx → endless MP retries). Acknowledged + recorded.
 * Chargebacks are routed separately (see chargebacks.service.ts). Unknown/missing topics keep the
 * legacy payment path.
 */
export const IGNORED_WEBHOOK_TOPICS = [
  'merchant_order',
  'topic_merchant_order_wh',
  'point_integration_wh',
  'delivery',
  'delivery_cancellation',
  'stop_delivery_op_wh',
  'topic_claims_integration_wh',
  'subscription_preapproval',
  'subscription_preapproval_plan',
  'subscription_authorized_payment',
  'topic_instore_integration_wh',
  'mp-connect',
  'wallet_connect',
] as const;

export function isIgnoredWebhookTopic(topic?: string | null): boolean {
  const t = String(topic || '').toLowerCase().trim();
  return (IGNORED_WEBHOOK_TOPICS as readonly string[]).includes(t);
}
