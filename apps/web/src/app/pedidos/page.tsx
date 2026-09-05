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
      <h1>Pedidos</h1>
      {err ? <div className="alert">{err}</div> : null}
      {orders.map((o) => (
        <Link key={o.id} href={`/pedidos/${o.publicId}`} className="card" style={{ display: 'block', marginBottom: 10 }}>
          <div className="body row">
            <div>
              <b>{o.publicId}</b>
              <div className="muted">{orderStatusLabel(o.status)}</div>
            </div>
            <div>{brl(o.total)}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}
