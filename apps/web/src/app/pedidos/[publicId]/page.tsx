'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, brl } from '@/lib/api';
import {
  FULFILLMENT_STEPS,
  fulfillmentStepIndex,
  orderStatusLabel,
} from '@/lib/order-status';

type Payment = {
  id: string;
  status: string;
  method: string;
  amount: number;
  externalId?: string | null;
  payload?: { qrCode?: string; qrCodeBase64?: string | null; note?: string } | null;
};

type Order = {
  id: string;
  publicId: string;
  status: string;
  total: number;
  discount: number;
  items: { id: string; qty: number; name: string; unitPrice: number }[];
  payments?: Payment[];
};

const MP_PUBLIC_KEY = process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY || '';

function pixQrImageSrc(qrCodeBase64?: string | null): string | null {
  if (!qrCodeBase64) return null;
  const trimmed = qrCodeBase64.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:')) return trimmed;
  return `data:image/png;base64,${trimmed}`;
}

function FulfillmentTimeline({ status }: { status: string }) {
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
          </div>
        </div>
      );
    }
    return null;
  }
  const activeIdx = current < 0 ? 0 : current;
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="body">
        <h3>Acompanhe a entrega</h3>
        <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
          Entrega realizada pela Lojas Schimitz.
        </p>
        <ol style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }}>
          {FULFILLMENT_STEPS.map((step, idx) => {
            const done = idx <= activeIdx;
            const isCurrent = idx === activeIdx;
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
                  <div style={{ fontWeight: isCurrent ? 800 : 600 }}>{orderStatusLabel(step)}</div>
                  {isCurrent ? (
                    <div className="muted" style={{ fontSize: 13 }}>
                      Status atual
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
    if (!o) return;
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
    const ext = intent?.payment?.externalId;
    if (!ext) {
      setErr('Intent sem externalId — recarregue a página.');
      return;
    }
    setSimulating(true);
    setErr('');
    try {
      await api('/webhooks/mercadopago', {
        method: 'POST',
        headers: { 'x-signature': 'null-test-secret', 'x-request-id': crypto.randomUUID() },
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
  const showTimeline = ['paid', 'separating', 'shipped', 'delivered'].includes(o.status);
  const isPixPending =
    intent?.payment?.method === 'pix' && intent.payment.status === 'pending';

  return (
    <div style={{ padding: '24px 0' }}>
      <h1>Pedido {o.publicId}</h1>
      <p>
        Status: <b>{orderStatusLabel(o.status)}</b>
      </p>
      {o.items?.map((i) => (
        <div key={i.id} className="row">
          <span>
            {i.qty}× {i.name}
          </span>
          <span>{brl(i.unitPrice)}</span>
        </div>
      ))}
      <p>
        Total {brl(o.total)} (desconto {brl(o.discount)})
      </p>

      {err ? <div className="alert">{err}</div> : null}

      {showTimeline ? <FulfillmentTimeline status={o.status} /> : null}

      {awaiting && !intent ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="body">
            <h3>Pagamento</h3>
            <p className="muted">Escolha o método: PIX ou cartão.</p>
            <label style={{ display: 'block', marginBottom: 8 }}>
              <input type="radio" checked={method === 'pix'} onChange={() => setMethod('pix')} /> PIX
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
            <button className="btn" disabled={paying} onClick={createIntent}>
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
              Status pagamento: <b>{intent.payment.status}</b>
            </p>
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
                      className="btn"
                      style={{ marginTop: 8 }}
                      onClick={copyPixCode}
                    >
                      {copied ? 'Código copiado!' : 'Copiar código PIX'}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
            {awaiting && intent.payment.status === 'pending' ? (
              <button className="btn" style={{ marginTop: 12 }} disabled={simulating} onClick={simulateApprove}>
                {simulating ? 'Confirmando...' : 'Simular aprovação (dev / provider null)'}
              </button>
            ) : null}
            {o.status === 'paid' ? (
              <p className="ok" style={{ marginTop: 12 }}>
                Pedido pago. Estamos preparando a separação.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
