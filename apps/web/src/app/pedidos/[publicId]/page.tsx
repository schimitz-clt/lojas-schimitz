'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { pixPrice, isPixPromoCollidingCouponCode } from '@/lib/pricing';
import { api, brl, isUnauthorizedError, waLink } from '@/lib/api';
import { useSessionUser } from '@/lib/use-session-user';
import { loginNextPath, orderRecoveryPaths, persistLastOrderPublicId, PIX_LEAVE_COPY } from '@/lib/order-recovery';
import {
  FULFILLMENT_STEPS,
  FULFILLMENT_JOURNEY_COPY,
  fulfillmentStepIndex,
  fulfillmentTimelineLabel,
  orderStatusLabel,
} from '@/lib/order-status';
import { isPixPaidLikeOrder, PIX_APPROVED_COPY, showPixGate } from '@/lib/pix-payment-ui';
import {
  buildCardIntentBody,
  CARD_APPROVED_COPY,
  CARD_PENDING_COPY,
  CARD_UNAVAILABLE_COPY,
  isCardBrickAvailable,
} from '@/lib/card-payment-ui';
import {
  deliveryEtaCopy,
  findDeliveredAt,
  type FreightSnapLike,
} from '@/lib/delivery-eta';
import { orderItemDisplayName, orderItemImageUrl } from '@/lib/order-card-ui';
import MercadoPagoCardBrick from '@/components/MercadoPagoCardBrick';
import { isPaymentSimulateUiEnabled, paymentSimulateWebhookSecret } from '@/lib/payment-simulate';
import Link from 'next/link';

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  refused: 'Recusado',
  expired: 'Expirado',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
};

function paymentStatusLabel(status: string) {
  return PAYMENT_STATUS_LABEL[status] || status;
}

type Payment = {
  id: string;
  status: string;
  method: string;
  amount: number;
  externalId?: string | null;
  payload?: { qrCode?: string; qrCodeBase64?: string | null; note?: string } | null;
};

type StatusHistory = {
  id: string;
  fromStatus?: string | null;
  toStatus: string;
  createdAt: string;
  note?: string | null;
};

type Order = {
  id: string;
  publicId: string;
  status: string;
  total: number;
  discount: number;
  trackingCode?: string | null;
  carrier?: string | null;
  freightSnap?: FreightSnapLike;
  items: {
    id: string;
    qty: number;
    name: string;
    productName?: string | null;
    unitPrice: number;
    sellerId?: string | null;
    imageUrl?: string | null;
    image?: string | null;
  }[];
  coupon?: { code?: string | null } | null;
  payments?: Payment[];
  statusHistory?: StatusHistory[];
  marketplaceSplit?: { active?: boolean; bricksPublicKey?: string | null } | null;
};

const MP_PUBLIC_KEY = process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY || '';
/** Dev-only: production Next builds always false (see payment-simulate.ts). */
const ALLOW_PAYMENT_SIMULATE = isPaymentSimulateUiEnabled();

function pixQrImageSrc(qrCodeBase64?: string | null): string | null {
  if (!qrCodeBase64) return null;
  const trimmed = qrCodeBase64.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:')) return trimmed;
  return `data:image/png;base64,${trimmed}`;
}

function formatTs(iso?: string) {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function historyTimeForStep(history: StatusHistory[] | undefined, step: string): string | null {
  if (!history?.length) return null;
  const aliases: Record<string, string[]> = {
    organizing: ['organizing', 'separating'],
    in_transit: ['in_transit', 'shipped'],
  };
  const match = [...history].reverse().find((h) => {
    const targets = aliases[step] || [step];
    return targets.includes(h.toStatus);
  });
  return match ? formatTs(match.createdAt) : null;
}

function FulfillmentTimeline({
  status,
  history,
  trackingCode,
  carrier,
  freightSnap,
}: {
  status: string;
  history?: StatusHistory[];
  trackingCode?: string | null;
  carrier?: string | null;
  freightSnap?: FreightSnapLike;
}) {
  const current = fulfillmentStepIndex(status);
  if (current < 0 && status !== 'paid') {
    if (status === 'cancelled' || status === 'refunded') {
      return (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="body">
            <h3>Situação do pedido</h3>
            <p>
              <b>{orderStatusLabel(status)}</b>
            </p>
            {history?.length ? (
              <ol style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }}>
                {history.map((h) => (
                  <li key={h.id} className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
                    {formatTs(h.createdAt)} — {orderStatusLabel(h.toStatus)}
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        </div>
      );
    }
    return null;
  }
  const activeIdx = current < 0 ? 0 : current;
  const etaCopy = deliveryEtaCopy({
    status,
    statusHistory: history,
    freightSnap,
    deliveredAt: findDeliveredAt(history),
  });
  return (
    <div className="card" id="order-tracking" style={{ marginTop: 16 }}>
      <div className="body">
        <h3>Rastreamento da entrega</h3>
        <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
          {FULFILLMENT_JOURNEY_COPY}
          <br />
          Entrega realizada pela Lojas Schimitz
          {carrier && carrier !== 'propria' ? ` · ${carrier}` : ''}.
        </p>
        {etaCopy ? (
          <p
            style={{
              marginTop: 12,
              marginBottom: 0,
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid var(--line)',
              background: 'rgba(245, 197, 24, 0.06)',
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {etaCopy}
          </p>
        ) : null}
        {trackingCode ? (
          <div
            style={{
              marginTop: 12,
              padding: '12px 14px',
              borderRadius: 10,
              border: '1px solid var(--primary)',
              background: 'rgba(245, 197, 24, 0.08)',
            }}
          >
            <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
              Código de rastreio
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 0.5, wordBreak: 'break-all' }}>
              {trackingCode}
            </div>
          </div>
        ) : status === 'in_transit' || status === 'shipped' ? (
          <p className="muted" style={{ fontSize: 14 }}>
            Código de rastreio será informado em breve.
          </p>
        ) : null}
        <ol style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }}>
          {FULFILLMENT_STEPS.map((step, idx) => {
            const done = idx <= activeIdx;
            const isCurrent = idx === activeIdx;
            const when = historyTimeForStep(history, step);
            return (
              <li
                key={step}
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                  marginBottom: 12,
                  opacity: done ? 1 : 0.45,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: done ? 'var(--ok)' : 'var(--line)',
                    color: '#111',
                    fontSize: 12,
                    fontWeight: 800,
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  {done ? '✓' : idx + 1}
                </span>
                <div>
                  <div style={{ fontWeight: isCurrent ? 800 : 600 }}>{fulfillmentTimelineLabel(step)}</div>
                  {isCurrent ? (
                    <div className="muted" style={{ fontSize: 13 }}>
                      Status atual{when ? ` · ${when}` : ''}
                    </div>
                  ) : when ? (
                    <div className="muted" style={{ fontSize: 13 }}>
                      {when}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

export default function PedidoPage() {
  const { publicId } = useParams<{ publicId: string }>();
  const { user, ready } = useSessionUser();
  const [o, setO] = useState<Order | null>(null);
  const [err, setErr] = useState('');
  const [method, setMethod] = useState<'pix' | 'card'>('pix');
  const [paying, setPaying] = useState(false);
  const [intent, setIntent] = useState<{ payment: Payment } | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [generatedQr, setGeneratedQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const reload = useCallback(() => {
    return api<Order>(`/orders/${publicId}`).then((order) => {
      setO(order);
      const pending = order.payments?.find((p) => p.status === 'pending');
      const approved = order.payments?.find((p) => p.status === 'approved');
      if (approved) setIntent({ payment: approved });
      else if (pending) setIntent({ payment: pending });
      return order;
    });
  }, [publicId]);

  useEffect(() => {
    if (publicId) persistLastOrderPublicId(String(publicId), window.localStorage);
    if (!ready) return;
    if (!user) {
      window.location.href = loginNextPath(`/pedidos/${publicId}`);
      return;
    }
    reload().catch((e) => {
      if (isUnauthorizedError(e)) {
        window.location.href = loginNextPath(`/pedidos/${publicId}`);
        return;
      }
      setErr(e.message);
    });
  }, [reload, publicId, ready, user]);

  // Enquanto PIX/pedido aguardam confirmação, atualiza sozinho (webhook → paid).
  useEffect(() => {
    if (!o) return;
    const awaiting = o.status === 'awaiting_payment' || o.status === 'draft';
    const payPending = intent?.payment?.status === 'pending';
    if (!awaiting && !payPending) return;
    const id = window.setInterval(() => {
      reload().catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(id);
  }, [o?.status, intent?.payment?.status, reload]);

  // Gate QR payload at the source so approved payments never keep showing pay UI
  // even if Mercado Pago payload still contains qrCode / qrCodeBase64.
  const showPixUi = showPixGate(intent?.payment?.status, o?.status, intent?.payment?.method);
  const qr = showPixUi ? intent?.payment?.payload?.qrCode || null : null;
  const qrFromMp = showPixUi ? pixQrImageSrc(intent?.payment?.payload?.qrCodeBase64) : null;
  const qrImgSrc = showPixUi ? qrFromMp || generatedQr : null;

  useEffect(() => {
    let cancelled = false;
    setGeneratedQr(null);
    if (qrFromMp || !qr) return;
    (async () => {
      try {
        const QRCode = (await import('qrcode')).default;
        const dataUrl = await QRCode.toDataURL(qr, {
          width: 280,
          margin: 2,
          errorCorrectionLevel: 'M',
        });
        if (!cancelled) setGeneratedQr(dataUrl);
      } catch {
        if (!cancelled) setGeneratedQr(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [qr, qrFromMp]);

  async function postPaymentIntent(body: Record<string, unknown>, persistKey: string) {
    let key = sessionStorage.getItem(persistKey);
    if (!key || key.length < 8) {
      key = crypto.randomUUID();
      sessionStorage.setItem(persistKey, key);
    }
    const data = await api<{ payment: Payment }>('/payments/intents', {
      method: 'POST',
      headers: { 'Idempotency-Key': key },
      body: JSON.stringify(body),
    });
    setIntent(data);
    await reload();
    return data;
  }

  /** PIX (or legacy) — card with public key goes through Brick onSubmit. */
  async function createIntent() {
    if (!o || paying) return;
    if (method === 'card') {
      setErr('Use o formulário de cartão abaixo para pagar.');
      return;
    }
    setPaying(true);
    setErr('');
    try {
      await postPaymentIntent({ orderId: o.id, method: 'pix' }, `sch_idem_pay:${o.id}:pix`);
    } catch (e: any) {
      setErr(e.message || 'Falha ao criar intenção de pagamento');
    } finally {
      setPaying(false);
    }
  }

  async function createCardIntentFromBrick(submit: {
    cardToken: string;
    installments: number;
    paymentMethodId?: string;
  }) {
    if (!o || paying) {
      throw new Error(paying ? 'Pagamento em andamento' : 'Pedido indisponível');
    }
    if (!isCardBrickAvailable(o.marketplaceSplit?.active ? (o.marketplaceSplit.bricksPublicKey || '') : MP_PUBLIC_KEY)) {
      const msg = CARD_UNAVAILABLE_COPY;
      setErr(msg);
      throw new Error(msg);
    }
    setPaying(true);
    setErr('');
    try {
      const body = buildCardIntentBody(o.id, submit, { requireToken: true });
      const persistKey = `sch_idem_pay:${o.id}:card:${body.installments}:${body.cardToken.slice(0, 12)}`;
      await postPaymentIntent(body, persistKey);
    } catch (e: any) {
      const msg = e.message || 'Falha ao processar cartão';
      setErr(msg);
      throw e instanceof Error ? e : new Error(msg);
    } finally {
      setPaying(false);
    }
  }

  async function simulateApprove() {
    if (!ALLOW_PAYMENT_SIMULATE) {
      setErr('Simulação desabilitada. Pagamento só confirma via provedor/webhook autenticado.');
      return;
    }
    const ext = intent?.payment?.externalId;
    if (!ext) {
      setErr('Intent sem externalId — recarregue a página.');
      return;
    }
    const simSecret = paymentSimulateWebhookSecret();
    if (!simSecret || simSecret.length < 16) {
      setErr('Simulação bloqueada — secret ausente/fraco (somente dev).');
      return;
    }
    setSimulating(true);
    setErr('');
    try {
      await api('/webhooks/mercadopago', {
        method: 'POST',
        headers: { 'x-signature': simSecret, 'x-request-id': crypto.randomUUID() },
        body: JSON.stringify({
          id: crypto.randomUUID(),
          type: 'payment',
          data: { id: ext },
          status: 'approved',
          amount: Number(o?.total),
        }),
      });
      await reload();
    } catch (e: any) {
      setErr(e.message || 'Falha ao simular webhook');
    } finally {
      setSimulating(false);
    }
  }

  async function copyPixCode() {
    if (!qr) return;
    try {
      await navigator.clipboard.writeText(qr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErr('Não foi possível copiar. Selecione o código e copie manualmente.');
    }
  }

  if (err && !o) return <div className="alert" style={{ marginTop: 24 }}>{err}</div>;
  if (!o) return <p className="muted">Carregando...</p>;

  const awaiting = o.status === 'awaiting_payment';
  const showTimeline = isPixPaidLikeOrder(o.status);
  const paidLike = isPixPaidLikeOrder(o.status);
  const pendingPay = awaiting || o.status === 'draft';
  const skipAutoPix = isPixPromoCollidingCouponCode(o.coupon?.code);
  const pixChargePreview = skipAutoPix ? Number(o.total) : pixPrice(o.total);
  const brickPublicKey =
    o.marketplaceSplit?.active ? o.marketplaceSplit.bricksPublicKey || '' : MP_PUBLIC_KEY;
  // Recompute with definite order (after load) — same rule as showPixUi above.
  const showPixPayUi = showPixGate(intent?.payment?.status, o.status, intent?.payment?.method);
  const supportHref = waLink(`Olá! Preciso de ajuda com o pedido ${o.publicId}.`);

  return (
    <div className="order-page" style={{ padding: '24px 0' }}>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        <Link href="/conta">Minha conta</Link> · Pedido
      </p>
      <h1 style={{ marginTop: 8 }}>Pedido {o.publicId}</h1>
      <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
        Código permanente: <b>{o.publicId}</b> — use este código no WhatsApp e em Meus pedidos.
      </p>

      <div className={`order-status-banner ${pendingPay ? 'is-pending' : paidLike ? 'is-paid' : 'is-other'}`}>
        <p style={{ margin: 0 }}>
          Status do pedido: <b>{orderStatusLabel(o.status)}</b>
        </p>
        {pendingPay ? (
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 14 }}>
            Aguardando pagamento. Conclua abaixo para confirmar o pedido — o status só muda para pago após aprovação.
          </p>
        ) : o.status === 'paid' ? (
          <p className="ok" style={{ margin: '6px 0 0', fontSize: 14 }}>
            Pagamento confirmado. Estamos organizando seu pedido.
          </p>
        ) : paidLike ? (
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 14 }}>
            Acompanhe a entrega na timeline abaixo.
          </p>
        ) : null}
      </div>

      <section className="card" style={{ marginTop: 12 }} aria-labelledby="order-items-heading">
        <div className="body">
          <h2 id="order-items-heading" className="checkout-section-title">Itens</h2>
          {o.items?.map((i) => {
            const name = orderItemDisplayName(i) || i.name;
            const src = orderItemImageUrl(i);
            return (
              <div key={i.id} className="checkout-line" style={{ marginBottom: 8 }}>
                <div className="checkout-line-media">
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt={name}
                      width={64}
                      height={64}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <span className="checkout-line-ph" aria-hidden>
                      SCH
                    </span>
                  )}
                </div>
                <div className="checkout-line-body">
                  <span className="checkout-line-name">
                    {i.qty}× {name}
                  </span>
                </div>
                <span>{brl(i.unitPrice)}</span>
              </div>
            );
          })}
          <p style={{ marginBottom: 0 }}>
            Total {brl(o.total)}
            {Number(o.discount) > 0 ? ` (desconto ${brl(o.discount)})` : ''}
          </p>
        </div>
      </section>

      {err ? <div className="alert" role="alert" style={{ marginTop: 12 }}>{err}</div> : null}

      {showTimeline ? (
        <FulfillmentTimeline
          status={o.status}
          history={o.statusHistory}
          trackingCode={o.trackingCode}
          carrier={o.carrier}
          freightSnap={o.freightSnap}
        />
      ) : null}

      {awaiting && !intent ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="body">
            <h3>Pagamento pendente</h3>
            <p className="muted">
              {skipAutoPix
                ? 'Escolha o método: PIX (cupom PIX já aplicado — sem segundo 5%) ou cartão. O pedido só fica pago após aprovação.'
                : 'Escolha o método: PIX (5% OFF) ou cartão. O pedido só fica pago após aprovação.'}
            </p>
            <label style={{ display: 'block', marginBottom: 8 }}>
              <input type="radio" checked={method === 'pix'} onChange={() => setMethod('pix')} />{' '}
              {skipAutoPix
                ? `PIX (${brl(pixChargePreview)})`
                : `PIX (5% off → ${brl(pixChargePreview)})`}
            </label>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <input type="radio" checked={method === 'card'} onChange={() => setMethod('card')} /> Cartão (valor integral {brl(o.total)})
            </label>
            {method === 'card' ? (
              isCardBrickAvailable(brickPublicKey) ? (
                <div style={{ marginBottom: 12 }}>
                  <MercadoPagoCardBrick
                    publicKey={brickPublicKey}
                    amount={Number(o.total)}
                    onSubmitPayment={createCardIntentFromBrick}
                    onError={(msg) => setErr(msg)}
                  />
                  {paying ? (
                    <p className="muted" style={{ fontSize: 14 }} aria-live="polite">
                      Processando cartão…
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="alert" role="alert" style={{ marginBottom: 12 }}>
                  {CARD_UNAVAILABLE_COPY}
                  <br />
                  <span className="muted" style={{ fontSize: 13 }}>
                    {o.marketplaceSplit?.active
                      ? 'Pagamento sandbox do vendedor sem public key TEST-. Use PIX neste pedido.'
                      : 'Falta NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY no serviço web (Railway).'}
                  </span>
                </div>
              )
            ) : null}
            {method === 'pix' ? (
              <button
                className="btn checkout-confirm-btn"
                disabled={paying}
                onClick={createIntent}
                style={{ width: '100%', maxWidth: 420, minHeight: 48 }}
                aria-busy={paying || undefined}
              >
                {paying ? 'Gerando pagamento...' : 'Pagar com PIX'}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {intent?.payment ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="body">
            <h3>Pagamento {intent.payment.method.toUpperCase()}</h3>
            <p>
              Status pagamento: <b>{paymentStatusLabel(intent.payment.status)}</b>
            </p>
            {showPixPayUi ? (
              <p className="muted" style={{ fontSize: 14 }}>
                {PIX_LEAVE_COPY}
              </p>
            ) : null}
            {showPixPayUi ? (
              <div style={{ marginTop: 8 }}>
                {qrImgSrc ? (
                  <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <img
                      src={qrImgSrc}
                      alt="QR Code PIX"
                      width={280}
                      height={280}
                      style={{
                        maxWidth: '100%',
                        height: 'auto',
                        background: '#fff',
                        border: '1px solid var(--line)',
                        borderRadius: 8,
                        padding: 8,
                      }}
                    />
                    <p className="muted" style={{ fontSize: 14, marginTop: 8, marginBottom: 0 }}>
                      Escaneie o QR Code no app do seu banco
                    </p>
                  </div>
                ) : qr ? (
                  <p className="muted" style={{ fontSize: 14 }}>
                    Gerando QR Code...
                  </p>
                ) : null}
                {qr ? (
                  <div>
                    <p className="muted" style={{ marginBottom: 6 }}>
                      PIX copia-e-cola:
                    </p>
                    <textarea readOnly value={qr} rows={3} style={{ width: '100%' }} />
                    <button
                      type="button"
                      className="btn checkout-confirm-btn"
                      style={{ marginTop: 8, width: '100%', maxWidth: 420, minHeight: 48 }}
                      onClick={copyPixCode}
                    >
                      {copied ? 'Código copiado!' : 'Copiar código PIX'}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
            {!showPixPayUi &&
            intent.payment.method === 'pix' &&
            (intent.payment.status === 'approved' || paidLike) ? (
              <p className="ok" style={{ marginTop: 12, fontWeight: 700 }}>
                {PIX_APPROVED_COPY}
              </p>
            ) : null}
            {intent.payment.method === 'card' &&
            (intent.payment.status === 'approved' || paidLike) ? (
              <p className="ok" style={{ marginTop: 12, fontWeight: 700 }}>
                {CARD_APPROVED_COPY}
              </p>
            ) : null}
            {intent.payment.method === 'card' &&
            intent.payment.status === 'pending' &&
            pendingPay ? (
              <p className="muted" style={{ marginTop: 12, fontSize: 14 }}>
                {CARD_PENDING_COPY}
              </p>
            ) : null}
            {ALLOW_PAYMENT_SIMULATE && showPixPayUi ? (
              <button className="btn" style={{ marginTop: 12 }} disabled={simulating} onClick={simulateApprove}>
                {simulating ? 'Confirmando...' : 'Simular aprovação (dev / provider null)'}
              </button>
            ) : null}
            {o.status === 'paid' ? (
              <p className="ok" style={{ marginTop: 12 }}>
                Pedido pago. Estamos organizando seu pedido.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="order-followup" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Link className="btn ghost" href={orderRecoveryPaths(o.publicId).verMeuPedido} style={{ minHeight: 44 }}>
            Ver meu pedido
          </Link>
          <Link className="btn ghost" href="/pedidos" style={{ minHeight: 44 }}>
            Meus pedidos
          </Link>
          {paidLike || showTimeline ? (
            <a className="btn ghost" href="#order-tracking" style={{ minHeight: 44 }}>
              Acompanhar pedido
            </a>
          ) : null}
        </div>
        <p className="checkout-support muted" style={{ marginTop: 14 }}>
          Precisa de ajuda?{' '}
          <a href={supportHref} target="_blank" rel="noopener noreferrer">
            WhatsApp (51) 99625-3766
          </a>
        </p>
      </div>
    </div>
  );
}
