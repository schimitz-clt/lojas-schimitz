/**
 * Card checkout helpers — Mercado Pago Card Payment Brick.
 * Never send PAN/CVV to our API; only Brick-issued cardToken.
 */

import { MAX_INSTALLMENTS } from './pricing';

export const CARD_UNAVAILABLE_COPY =
  'Pagamento com cartão indisponível no momento. Use PIX (5% OFF) ou tente mais tarde.';

export const CARD_APPROVED_COPY = 'Pagamento no cartão: Aprovado';

export const CARD_PENDING_COPY =
  'Processando pagamento no cartão… Esta página atualiza automaticamente quando houver confirmação.';

/** Soft copy under the Brick — options depend on card + MP account, not a hard "sempre 12x". */
export const CARD_BRICK_INSTALLMENTS_HINT =
  'As parcelas disponíveis dependem do cartão de crédito e das configurações da conta Mercado Pago. Débito costuma ser apenas 1x. Seus dados do cartão não passam pelos servidores da Lojas Schimitz.';

/** Public key present → customer can use Card Payment Brick. */
export function isCardBrickAvailable(publicKey?: string | null): boolean {
  return Boolean(publicKey && String(publicKey).trim().length > 8);
}

export type CardBrickSubmit = {
  cardToken: string;
  installments: number;
  paymentMethodId?: string;
};

/**
 * Card Payment Brick `customization.paymentMethods` — max options (12).
 * Interest-free vitrine copy uses INTEREST_FREE_INSTALLMENTS (3); do not
 * treat this max as a “sem juros” claim. Actual options still depend on
 * the card + Mercado Pago account installment settings.
 */
export function cardBrickPaymentMethodsCustomization(): {
  minInstallments: number;
  maxInstallments: number;
} {
  return {
    minInstallments: 1,
    maxInstallments: MAX_INSTALLMENTS,
  };
}

/**
 * Body for POST /payments/intents (card). Requires token when Brick/public key is enabled.
 * Does not include PAN/CVV.
 */
export function buildCardIntentBody(
  orderId: string,
  submit: CardBrickSubmit,
  opts?: { requireToken?: boolean },
): { orderId: string; method: 'card'; cardToken: string; installments: number; paymentMethodId?: string } {
  const token = String(submit.cardToken || '').trim();
  const requireToken = opts?.requireToken !== false;
  if (requireToken && token.length < 8) {
    throw new Error('cardToken obrigatório — use o formulário de cartão (Brick)');
  }
  const installments = Math.max(1, Math.min(24, Math.floor(Number(submit.installments) || 1)));
  const body: {
    orderId: string;
    method: 'card';
    cardToken: string;
    installments: number;
    paymentMethodId?: string;
  } = {
    orderId,
    method: 'card',
    cardToken: token,
    installments,
  };
  const pm = submit.paymentMethodId ? String(submit.paymentMethodId).trim() : '';
  if (pm) body.paymentMethodId = pm;
  return body;
}

/** Normalize Brick onSubmit formData → our API fields. */
export function mapBrickFormDataToCardSubmit(formData: {
  token?: string;
  installments?: number;
  payment_method_id?: string;
}): CardBrickSubmit {
  return {
    cardToken: String(formData.token || '').trim(),
    installments: Math.max(1, Math.min(24, Math.floor(Number(formData.installments) || 1))),
    paymentMethodId: formData.payment_method_id ? String(formData.payment_method_id) : undefined,
  };
}
