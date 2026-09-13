'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, brl, currentUser } from '@/lib/api';
import { orderStatusLabel } from '@/lib/order-status';
import {
  loginNextPath,
  orderRecoveryPaths,
  readLastOrderPublicId,
} from '@/lib/order-recovery';

export default function PedidosPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [err, setErr] = useState('');
  const [lastPublicId, setLastPublicId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser()) {
      window.location.href = loginNextPath('/pedidos');
      return;
    }
    setLastPublicId(readLastOrderPublicId(window.localStorage));
    api<any[]>('/orders').then(setOrders).catch((e) => setErr(e.message));
  }, []);

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
      {orders.map((o) => (
        <Link key={o.id} href={`/pedidos/${o.publicId}`} className="card order-card" style={{ display: 'block', marginBottom: 10 }}>
          <div className="body row">
            <div>
              <b>{o.publicId}</b>
              <div className="muted">{orderStatusLabel(o.status)}</div>
            </div>
            <div style={{ fontWeight: 800 }}>{brl(o.total)}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}
