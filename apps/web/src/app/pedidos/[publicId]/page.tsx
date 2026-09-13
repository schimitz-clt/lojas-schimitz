'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { pixPrice } from '@/lib/pricing';
import { api, brl, waLink } from '@/lib/api';
import {
  FULFILLMENT_STEPS,
  FULFILLMENT_JOURNEY_COPY,
  fulfillmentStepIndex,
  fulfillmentTimelineLabel,
  orderStatusLabel,
} from '@/lib/order-status';
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
  items: { id: string; qty: number; name: string; unitPrice: number; sellerId?: string | null }[];
  payments?: Payment[];
  statusHistory?: StatusHistory[];
};

const MP_PUBLIC_KEY = process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY || '';
/** Dev-only: never enable in production builds. Requires matching ALLOW_NULL_PAYMENT_SIMULATE on API. */
const ALLOW_PAYMENT_SIMULATE = process.env.NEXT_PUBLIC_ALLOW_PAYMENT_SIMULATE === 'true';

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
}: {
  status: string;
  history?: StatusHistory[];
  trackingCode?: string | null;
  carrier?: string | null;
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
  const [o, setO] = useState<Order | null>(null);
  const [err, setErr] = useState('');
  const [method, setMethod] = useState<'pix' | 'card'>('pix');
  const [installments, setInstallments] = useState(1);
  const [paying, setPaying] = useState(false);
  const [intent, setIntent] = useState<{ payment: Payment } | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [cardToken, setCardToken] = useState('');
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
    reload().catch((e) => setErr(e.message));
  }, [reload]);

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

  const qr = intent?.payment?.payload?.qrCode || null;
  const qrFromMp = pixQrImageSrc(intent?.payment?.payload?.qrCodeBase64);
  const qrImgSrc = qrFromMp || generatedQr;

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

  async function createIntent() {
    if (!o || paying) return;
    setPaying(true);
    setErr('');
    try {
      const persistKey =
        method === 'card'
          ? `sch_idem_pay:${o.id}:${method}:${installments}`
          : `sch_idem_pay:${o.id}:${method}`;
      let key = sessionStorage.getItem(persistKey);
      if (!key || key.length < 8) {
        key = crypto.randomUUID();
        sessionStorage.setItem(persistKey, key);
      }
      const body: Record<string, unknown> = { orderId: o.id, method };
      if (method === 'card') {
        body.installments = installments;
        if (cardToken) body.cardToken = cardToken;
      }
      const data = await api<{ payment: Payment }>('/payments/intents', {
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body: JSON.stringify(body),
      });
      setIntent(data);
      await reload();
    } catch (e: any) {
      setErr(e.message || 'Falha ao criar intenção de pagamento');
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
    const simSecret = process.env.NEXT_PUBLIC_NULL_WEBHOOK_SECRET || '';
    if (!simSecret || simSecret.length < 16) {
      setErr('NEXT_PUBLIC_NULL_WEBHOOK_SECRET ausente/fraco — simulação bloqueada.');
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
  const showTimeline = ['paid', 'organizing', 'packing', 'ready_for_pickup', 'in_transit', 'delivered', 'separating', 'shipped'].includes(o.status);
  const isPixPending =
    intent?.payment?.method === 'pix' && intent.payment.status === 'pending';

  const paidLike = ['paid', 'organizing', 'packing', 'ready_for_pickup', 'in_transit', 'delivered', 'separating', 'shipped'].includes(o.status);
  const pendingPay = awaiting || o.status === 'draft';
  const supportHref = waLink(`Olá! Preciso de ajuda com o pedido ${o.publicId}.`);

  return (
    <div className="order-page" style={{ padding: '24px 0' }}>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        <Link href="/conta">Minha conta</Link> · Pedido
      </p>
      <h1 style={{ marginTop: 8 }}>Pedido {o.publicId}</h1>

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
          {o.items?.map((i) => (
            <div key={i.id} className="row" style={{ marginBottom: 6 }}>
              <span>
                {i.qty}× {i.name}
              </span>
              <span>{brl(i.unitPrice)}</span>
            </div>
          ))}
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
        />
      ) : null}

      {awaiting && !intent ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="body">
            <h3>Pagamento pendente</h3>
            <p className="muted">Escolha o método: PIX (5% OFF) ou cartão. O pedido só fica pago após aprovação.</p>
            <label style={{ display: 'block', marginBottom: 8 }}>
              <input type="radio" checked={method === 'pix'} onChange={() => setMethod('pix')} /> PIX (5% off → {brl(pixPrice(o.total))})
            </label>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <input type="radio" checked={method === 'card'} onChange={() => setMethod('card')} /> Cartão
            </label>
            {method === 'card' ? (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 8 }}>
                  Parcelas
                  <select
                    value={installments}
                    onChange={(e) => setInstallments(Number(e.target.value))}
                    style={{ display: 'block', width: '100%', marginTop: 6 }}
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n === 1 ? '1x (à vista)' : `${n}x`}
                      </option>
                    ))}
                  </select>
                </label>
                {MP_PUBLIC_KEY ? (
                  <p className="muted" style={{ fontSize: 14 }}>
                    Public key configurada. Monte o Checkout Bricks no cliente e cole o token abaixo
                    (API nunca recebe PAN/CVV).
                  </p>
                ) : (
                  <p className="muted" style={{ fontSize: 14 }}>
                    Sem <code>NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY</code>: em <code>PAYMENTS_PROVIDER=null</code>
                    a intent de cartão funciona sem token. Com Mercado Pago real, informe o cardToken do Bricks.
                  </p>
                )}
                <input
                  placeholder="cardToken (Bricks) — opcional no provider null"
                  value={cardToken}
                  onChange={(e) => setCardToken(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
            ) : null}
            <button
              className="btn checkout-confirm-btn"
              disabled={paying}
              onClick={createIntent}
              style={{ width: '100%', maxWidth: 420, minHeight: 48 }}
              aria-busy={paying || undefined}
            >
              {paying
                ? 'Gerando pagamento...'
                : method === 'card'
                  ? `Pagar no cartão (${installments}x)`
                  : 'Pagar com PIX'}
            </button>
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
            {intent.payment.status === 'pending' ? (
              <p className="muted" style={{ fontSize: 14 }}>
                Depois de pagar, esta página atualiza sozinha em alguns segundos.
              </p>
            ) : null}
            {isPixPending || (intent.payment.method === 'pix' && (qr || qrImgSrc)) ? (
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
            {ALLOW_PAYMENT_SIMULATE && awaiting && intent.payment.status === 'pending' ? (
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
        {paidLike || showTimeline ? (
          <a className="btn ghost" href="#order-tracking" style={{ minHeight: 44 }}>
            Acompanhar pedido
          </a>
        ) : (
          <Link className="btn ghost" href="/conta" style={{ minHeight: 44 }}>
            Ver meus pedidos
          </Link>
        )}
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
