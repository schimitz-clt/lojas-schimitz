'use client';
import { useEffect, useState } from 'react';
import { api, currentUser } from '@/lib/api';

export default function AdminPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    const u = currentUser();
    if (!u || u.role !== 'admin') {
      setErr('Acesso restrito a admin. Entre com a conta do seed.');
      return;
    }
    Promise.all([api<any[]>('/admin/products'), api<any[]>('/admin/orders')])
      .then(([p, o]) => { setProducts(p); setOrders(o); })
      .catch((e) => setErr(e.message));
  }, []);

  return (
    <div style={{ padding: '24px 0' }}>
      <h1>Admin Schimitz</h1>
      {err ? <div className="alert">{err}</div> : null}
      <h3>Produtos ({products.length})</h3>
      {products.map((p) => <div key={p.id} className="muted">{p.sku} — {p.name}</div>)}
      <h3>Pedidos ({orders.length})</h3>
      {orders.map((o) => <div key={o.id} className="muted">{o.publicId} — {o.status}</div>)}
    </div>
  );
}
