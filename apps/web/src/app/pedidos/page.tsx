'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, brl } from '@/lib/api';
import { useSessionUser } from '@/lib/use-session-user';
import { orderStatusLabel } from '@/lib/order-status';
import {
  extraItemsCount,
  orderCardImageUrl,
  orderCardTitleOrCode,
} from '@/lib/order-card-ui';
import { OrderCardThumb } from '@/components/order/OrderCardThumb';
import {
  loginNextPath,
  orderRecoveryPaths,
  readLastOrderPublicId,
} from '@/lib/order-recovery';

type OrderListRow = {
  id: string;
  publicId: string;
  status: string;
  total: number | string;
  items?: Array<{
    id?: string;
    name?: string;
    productName?: string;
    imageUrl?: string | null;
    image?: string | null;
  }>;
};

export default function PedidosPage() {
  const { user, ready } = useSessionUser();
  const [orders, setOrders] = useState<OrderListRow[]>([]);
  const [err, setErr] = useState('');
  const [lastPublicId, setLastPublicId] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      window.location.href = loginNextPath('/pedidos');
      return;
    }
    setLastPublicId(readLastOrderPublicId(window.localStorage));
    api<OrderListRow[]>('/orders').then(setOrders).catch((e) => setErr(e.message));
  }, [ready, user]);

  const lastStillListed = lastPublicId && orders.some((o) => o.publicId === lastPublicId);
  const lastPaths = lastPublicId ? orderRecoveryPaths(lastPublicId) : null;

  return (
    <div style={{ padding: '24px 0' }}>
      <div className="row" style={{ marginBottom: 8 }}>
        <h1 style={{ margin: 0 }}>Meus pedidos</h1>
        <Link className="btn ghost" href="/conta">Voltar à conta</Link>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        Acompanhe pagamento, frete e status de cada compra. Pedidos aguardando PIX e pedidos pagos aparecem aqui.
      </p>
      {lastPublicId && !lastStillListed ? (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="body">
            <p style={{ margin: 0 }}>
              Último pedido nesta sessão: <b>{lastPublicId}</b>
            </p>
            <p className="muted" style={{ margin: '6px 0 0', fontSize: 14 }}>
              Se você copiou o PIX e saiu da página, o pedido continua salvo. Abra pelo código.
            </p>
            {lastPaths ? (
              <Link className="btn" href={lastPaths.verMeuPedido} style={{ marginTop: 10, minHeight: 44 }}>
                Ver meu pedido
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
      {err ? <div className="alert">{err}</div> : null}
      {!err && orders.length === 0 ? (
        <div className="catalog-empty">
          <p style={{ margin: 0, fontWeight: 700 }}>Você ainda não tem pedidos.</p>
          <p className="muted" style={{ margin: '8px 0 12px' }}>Explore o catálogo e finalize na sacola.</p>
          <Link className="btn" href="/produtos">Ver produtos</Link>
        </div>
      ) : null}
      {orders.map((o) => {
        const title = orderCardTitleOrCode(o);
        const img = orderCardImageUrl(o.items);
        const extra = extraItemsCount(o.items);
        return (
          <Link
            key={o.id}
            href={`/pedidos/${o.publicId}`}
            className="card order-card"
            style={{ display: 'block', marginBottom: 10 }}
          >
            <div className="body order-card-inner">
              <OrderCardThumb src={img} extra={extra} />
              <div className="order-card-copy">
                <div className="order-card-title">{title}</div>
                <div className="order-card-status muted">{orderStatusLabel(o.status)}</div>
                <div className="order-card-id muted">{o.publicId}</div>
              </div>
              <div className="order-card-total">{brl(o.total)}</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
