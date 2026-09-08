'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, brl } from '@/lib/api';
import { orderStatusLabel } from '@/lib/order-status';

export default function PedidosPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [err, setErr] = useState('');
  useEffect(() => {
    api<any[]>('/orders').then(setOrders).catch((e) => setErr(e.message));
  }, []);
  return (
    <div style={{ padding: '24px 0' }}>
      <div className="row" style={{ marginBottom: 8 }}>
        <h1 style={{ margin: 0 }}>Meus pedidos</h1>
        <Link className="btn ghost" href="/conta">Voltar à conta</Link>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>Acompanhe pagamento, frete e status de cada compra.</p>
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
