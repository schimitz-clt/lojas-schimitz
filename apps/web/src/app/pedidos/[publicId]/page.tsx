'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api, brl, isUnauthorizedError, waLink } from '@/lib/api';
import { useSessionUser } from '@/lib/use-session-user';
import { loginNextPath, persistLastOrderPublicId } from '@/lib/order-recovery';
import {
  FULFILLMENT_STEPS,
  FULFILLMENT_JOURNEY_COPY,
  fulfillmentStepIndex,
  fulfillmentTimelineLabel,
  orderStatusLabel,
} from '@/lib/order-status';
import { isPixPaidLikeOrder } from '@/lib/pix-payment-ui';
import { orderItemDisplayName, orderItemImageUrl } from '@/lib/order-card-ui';
import { useOrderLiveReload } from '@/lib/use-order-live-reload';

type Payment = {
  id: string;
  status: string;
  method: string;
  amount: number;
};

type StatusHistory = {
  id: string;
  fromStatus?: string | null;
  toStatus: string;
  createdAt: string;
};

type Order = {
  id: string;
  publicId: string;
  status: string;
  total: number;
  discount: number;
  trackingCode?: string | null;
  carrier?: string | null;
  items: {
    id: string;
    qty: number;
    name: string;
    productName?: string | null;
    unitPrice: number;
    imageUrl?: string | null;
    image?: string | null;
  }[];
  payments?: Payment[];
  statusHistory?: StatusHistory[];
};

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

export default function PedidoPage() {
  const { publicId } = useParams<{ publicId: string }>();
  const { user, ready } = useSessionUser();
  const [o, setO] = useState<Order | null>(null);
  const [err, setErr] = useState('');
  const [intentStatus, setIntentStatus] = useState<string | undefined>();

  const reload = useCallback(() => {
    return api<Order>(`/orders/${publicId}`).then((order) => {
      setO(order);
      const pending = order.payments?.find((p) => p.status === 'pending');
      const approved = order.payments?.find((p) => p.status === 'approved');
      setIntentStatus((approved || pending)?.status);
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

  useOrderLiveReload(o?.status, intentStatus, reload);

  if (err && !o) return <div className="alert" style={{ marginTop: 24 }}>{err}</div>;
  if (!o) return <p className="muted">Carregando...</p>;

  const pendingPay = o.status === 'awaiting_payment' || o.status === 'draft';
  const paidLike = isPixPaidLikeOrder(o.status);
  const current = fulfillmentStepIndex(o.status);
  const activeIdx = current < 0 ? 0 : current;
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
        <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
          Esta tela atualiza sozinha. Não precisa recarregar a página.
        </p>
      </div>

      <section className="card" style={{ marginTop: 12 }}>
        <div className="body">
          <h2 className="checkout-section-title">Itens</h2>
          {o.items?.map((i) => {
            const name = orderItemDisplayName(i) || i.name;
            const src = orderItemImageUrl(i);
            return (
              <div key={i.id} className="checkout-line" style={{ marginBottom: 8 }}>
                <div className="checkout-line-media">
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt={name} width={64} height={64} />
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

      {paidLike ? (
        <div className="card" id="order-tracking" style={{ marginTop: 16 }}>
          <div className="body">
            <h3>Rastreamento da entrega</h3>
            <p className="muted" style={{ fontSize: 14 }}>
              {FULFILLMENT_JOURNEY_COPY}
            </p>
            {o.trackingCode ? (
              <p>
                <b>Rastreio:</b> {o.trackingCode}
                {o.carrier ? ` · ${o.carrier}` : ''}
              </p>
            ) : null}
            <ol style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }}>
              {FULFILLMENT_STEPS.map((step, idx) => {
                const done = idx <= activeIdx;
                const isCurrent = idx === activeIdx;
                return (
                  <li key={step} style={{ display: 'flex', gap: 12, marginBottom: 12, opacity: done ? 1 : 0.45 }}>
                    <span
                      aria-hidden
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: done ? 'var(--ok)' : 'var(--line)',
                        display: 'grid',
                        placeItems: 'center',
                        fontWeight: 800,
                        fontSize: 12,
                      }}
                    >
                      {done ? '✓' : idx + 1}
                    </span>
                    <div>
                      <div style={{ fontWeight: isCurrent ? 800 : 600 }}>{fulfillmentTimelineLabel(step)}</div>
                      {isCurrent ? <div className="muted" style={{ fontSize: 13 }}>Status atual</div> : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      ) : null}

      {pendingPay ? (
        <p className="muted" style={{ marginTop: 16 }}>
          Se o pagamento ainda não apareceu, abra de novo pelo checkout ou fale no WhatsApp.
        </p>
      ) : null}

      <p style={{ marginTop: 20 }}>
        <a className="btn" href={supportHref}>
          Ajuda no WhatsApp
        </a>
      </p>
    </div>
  );
}
