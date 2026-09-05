'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, brl } from '@/lib/api';

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

export default function PedidoPage() {
  const { publicId } = useParams<{ publicId: string }>();
  const [o, setO] = useState<Order | null>(null);
  const [err, setErr] = useState('');
  const [method, setMethod] = useState<'pix' | 'card'>('pix');
  const [paying, setPaying] = useState(false);
  const [intent, setIntent] = useState<{ payment: Payment } | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [cardToken, setCardToken] = useState('');

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

  async function createIntent() {
    if (!o) return;
    setPaying(true);
    setErr('');
    try {
      const persistKey = `sch_idem_pay:${o.id}:${method}`;
      let key = sessionStorage.getItem(persistKey);
      if (!key || key.length < 8) {
        key = crypto.randomUUID();
        sessionStorage.setItem(persistKey, key);
      }
      const body: Record<string, unknown> = { orderId: o.id, method };
      if (method === 'card' && cardToken) body.cardToken = cardToken;
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

  if (err && !o) return <div className="alert" style={{ marginTop: 24 }}>{err}</div>;
  if (!o) return <p className="muted">Carregando...</p>;

  const awaiting = o.status === 'awaiting_payment';
  const qr = intent?.payment?.payload?.qrCode;

  return (
    <div style={{ padding: '24px 0' }}>
      <h1>Pedido {o.publicId}</h1>
      <p>Status: <b>{o.status}</b></p>
      {o.items?.map((i) => (
        <div key={i.id} className="row"><span>{i.qty}× {i.name}</span><span>{brl(i.unitPrice)}</span></div>
      ))}
      <p>Total {brl(o.total)} (desconto {brl(o.discount)})</p>

      {err ? <div className="alert">{err}</div> : null}

      {awaiting && !intent ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="body">
            <h3>Pagamento (SCH-003)</h3>
            <p className="muted">Escolha o método (MVP: PIX ou cartão). Intent em rota separada.</p>
            <label style={{ display: 'block', marginBottom: 8 }}>
              <input type="radio" checked={method === 'pix'} onChange={() => setMethod('pix')} /> PIX
            </label>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <input type="radio" checked={method === 'card'} onChange={() => setMethod('card')} /> Cartão
            </label>
            {method === 'card' ? (
              <div style={{ marginBottom: 12 }}>
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
              {paying ? 'Gerando pagamento...' : 'Pagar agora'}
            </button>
          </div>
        </div>
      ) : null}

      {intent?.payment ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="body">
            <h3>Intent {intent.payment.method.toUpperCase()}</h3>
            <p>Status pagamento: <b>{intent.payment.status}</b></p>
            {qr ? (
              <div>
                <p className="muted">PIX copia-e-cola:</p>
                <textarea readOnly value={qr} rows={3} style={{ width: '100%' }} />
              </div>
            ) : null}
            {awaiting && intent.payment.status === 'pending' ? (
              <button className="btn" style={{ marginTop: 12 }} disabled={simulating} onClick={simulateApprove}>
                {simulating ? 'Confirmando...' : 'Simular aprovação (dev / provider null)'}
              </button>
            ) : null}
            {o.status === 'paid' ? <p style={{ color: 'green' }}>Pedido pago. Estoque confirmado (commitSale).</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
