'use client';

import { useEffect, useRef } from 'react';
import { CardPayment, initMercadoPago } from '@mercadopago/sdk-react';

export type CardBrickSubmit = {
  cardToken: string;
  installments: number;
  paymentMethodId?: string;
  issuerId?: string;
};

type Props = {
  publicKey: string;
  amount: number;
  payerEmail?: string;
  onSubmit: (data: CardBrickSubmit) => Promise<void>;
  onError?: (message: string) => void;
};

/**
 * Checkout Bricks — cartão. Tokeniza no cliente (sem PAN/CVV na API da loja).
 * Só monta com public key; PIX continua no fluxo custom da página do pedido.
 */
export function MercadoPagoCardBrick({ publicKey, amount, payerEmail, onSubmit, onError }: Props) {
  const readyRef = useRef(false);
  const amountSafe = Math.max(0.01, Number(amount) || 0);

  useEffect(() => {
    if (!publicKey) return;
    initMercadoPago(publicKey, { locale: 'pt-BR' });
    readyRef.current = true;
  }, [publicKey]);

  if (!publicKey || amountSafe <= 0) return null;

  return (
    <div className="mp-card-brick" data-testid="mp-card-brick">
      <CardPayment
        locale="pt-BR"
        initialization={{
          amount: amountSafe,
          ...(payerEmail ? { payer: { email: payerEmail } } : {}),
        }}
        customization={{
          paymentMethods: {
            maxInstallments: 12,
            minInstallments: 1,
          },
        }}
        onSubmit={async (formData) => {
          const token = String(formData?.token || '').trim();
          if (!token) {
            onError?.('Não foi possível tokenizar o cartão. Tente novamente.');
            throw new Error('CARD_TOKEN_MISSING');
          }
          await onSubmit({
            cardToken: token,
            installments: Math.max(1, Number(formData.installments) || 1),
            paymentMethodId: formData.payment_method_id
              ? String(formData.payment_method_id)
              : undefined,
            issuerId: formData.issuer_id ? String(formData.issuer_id) : undefined,
          });
        }}
        onError={(err) => {
          const msg =
            (err && typeof err === 'object' && 'message' in err && String((err as { message?: string }).message)) ||
            'Erro no formulário de cartão do Mercado Pago';
          onError?.(msg);
        }}
      />
    </div>
  );
}
