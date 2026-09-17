'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CARD_BRICK_INSTALLMENTS_HINT,
  cardBrickPaymentMethodsCustomization,
  mapBrickFormDataToCardSubmit,
  type CardBrickSubmit,
} from '@/lib/card-payment-ui';

const MP_SDK_URL = 'https://sdk.mercadopago.com/js/v2';
const CONTAINER_ID = 'mpCardPaymentBrick_container';

type MercadoPagoCtor = new (
  publicKey: string,
  options?: { locale?: string },
) => {
  bricks: () => {
    create: (
      brick: string,
      containerId: string,
      settings: Record<string, unknown>,
    ) => Promise<{ unmount?: () => void }>;
  };
};

declare global {
  interface Window {
    MercadoPago?: MercadoPagoCtor;
  }
}

let sdkLoadPromise: Promise<void> | null = null;

function loadMercadoPagoSdk(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('SDK só no cliente'));
  }
  if (window.MercadoPago) return Promise.resolve();
  if (sdkLoadPromise) return sdkLoadPromise;

  sdkLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-sch-mp-sdk="v2"]');
    if (existing) {
      if (window.MercadoPago) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error('Falha ao carregar SDK Mercado Pago')),
        { once: true },
      );
      return;
    }
    const script = document.createElement('script');
    script.src = MP_SDK_URL;
    script.async = true;
    script.dataset.schMpSdk = 'v2';
    script.onload = () => resolve();
    script.onerror = () => {
      sdkLoadPromise = null;
      reject(new Error('Falha ao carregar SDK Mercado Pago'));
    };
    document.body.appendChild(script);
  });

  return sdkLoadPromise;
}

export type MercadoPagoCardBrickProps = {
  publicKey: string;
  /** Valor integral do pedido (sem desconto PIX), em BRL. */
  amount: number;
  onSubmitPayment: (data: CardBrickSubmit) => Promise<void>;
  onError?: (message: string) => void;
};

/**
 * Mercado Pago Card Payment Brick — tokenização no cliente.
 * PAN/CVV nunca passam pela API Schimitz.
 */
export default function MercadoPagoCardBrick({
  publicKey,
  amount,
  onSubmitPayment,
  onError,
}: MercadoPagoCardBrickProps) {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const controllerRef = useRef<{ unmount?: () => void } | null>(null);
  const onSubmitRef = useRef(onSubmitPayment);
  const onErrorRef = useRef(onError);
  onSubmitRef.current = onSubmitPayment;
  onErrorRef.current = onError;

  const amountNum = Math.round(Number(amount) * 100) / 100;

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setLoadError('');

    async function mount() {
      if (!publicKey || amountNum <= 0) {
        setLoadError('Não foi possível iniciar o pagamento com cartão.');
        return;
      }
      try {
        await loadMercadoPagoSdk();
        if (cancelled || !window.MercadoPago) return;

        try {
          controllerRef.current?.unmount?.();
        } catch {
          /* ignore prior unmount */
        }
        controllerRef.current = null;

        const container = document.getElementById(CONTAINER_ID);
        if (container) container.innerHTML = '';

        const mp = new window.MercadoPago(publicKey, { locale: 'pt-BR' });
        const bricksBuilder = mp.bricks();

        const controller = await bricksBuilder.create('cardPayment', CONTAINER_ID, {
          initialization: { amount: amountNum },
          customization: {
            paymentMethods: cardBrickPaymentMethodsCustomization(),
          },
          localization: { locale: 'pt-BR' },
          callbacks: {
            onReady: () => {
              if (!cancelled) setReady(true);
            },
            onError: (error: { message?: string } | unknown) => {
              const msg =
                error && typeof error === 'object' && 'message' in error && (error as { message?: string }).message
                  ? String((error as { message?: string }).message)
                  : 'Erro no formulário de cartão';
              if (!cancelled) {
                setLoadError(msg);
                onErrorRef.current?.(msg);
              }
            },
            onSubmit: (formData: {
              token?: string;
              installments?: number;
              payment_method_id?: string;
            }) => {
              return new Promise<void>((resolve, reject) => {
                const mapped = mapBrickFormDataToCardSubmit(formData);
                if (!mapped.cardToken || mapped.cardToken.length < 8) {
                  reject(new Error('Token do cartão inválido'));
                  return;
                }
                onSubmitRef
                  .current(mapped)
                  .then(() => resolve())
                  .catch((err: unknown) => {
                    const message =
                      err && typeof err === 'object' && 'message' in err
                        ? String((err as { message?: string }).message)
                        : 'Falha ao processar cartão';
                    onErrorRef.current?.(message);
                    reject(err instanceof Error ? err : new Error(message));
                  });
              });
            },
          },
        });

        if (cancelled) {
          try {
            controller?.unmount?.();
          } catch {
            /* ignore */
          }
          return;
        }
        controllerRef.current = controller;
      } catch (e: unknown) {
        if (cancelled) return;
        const message =
          e && typeof e === 'object' && 'message' in e
            ? String((e as { message?: string }).message)
            : 'Não foi possível carregar o formulário de cartão';
        setLoadError(message);
        onErrorRef.current?.(message);
      }
    }

    void mount();

    return () => {
      cancelled = true;
      try {
        controllerRef.current?.unmount?.();
      } catch {
        /* ignore */
      }
      controllerRef.current = null;
    };
  }, [publicKey, amountNum]);

  return (
    <div
      className="mp-card-brick"
      style={{
        marginTop: 4,
        marginBottom: 8,
        padding: '12px 12px 4px',
        borderRadius: 12,
        border: '1px solid var(--line)',
        background: 'rgba(255,255,255,0.04)',
      }}
    >
      <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: 15 }}>Cartão de crédito</p>
      <p className="muted" style={{ margin: '0 0 12px', fontSize: 13 }}>
        {CARD_BRICK_INSTALLMENTS_HINT}
      </p>
      {!ready && !loadError ? (
        <p className="muted" style={{ fontSize: 14, marginBottom: 8 }}>
          Carregando formulário seguro…
        </p>
      ) : null}
      {loadError ? (
        <div className="alert" role="alert" style={{ marginBottom: 8 }}>
          {loadError}
        </div>
      ) : null}
      <div id={CONTAINER_ID} />
    </div>
  );
}
