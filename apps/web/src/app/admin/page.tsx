'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, brl, currentUser } from '@/lib/api';
import { nextFulfillmentStatus, orderStatusLabel } from '@/lib/order-status';

type AdminOrder = {
  id: string;
  publicId: string;
  status: string;
  total: number;
  items?: { name: string; qty: number }[];
};

export default function AdminPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    const u = currentUser();
    if (!u || u.role !== 'admin') {
      setErr('Acesso restrito a admin. Entre com a conta do seed.');
      return Promise.resolve();
    }
    return Promise.all([api<any[]>('/admin/products'), api<AdminOrder[]>('/admin/orders')])
      .then(([p, o]) => {
        setProducts(p);
        setOrders(o);
        setErr('');
      })
      .catch((e) => setErr(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function advance(order: AdminOrder) {
    const next = nextFulfillmentStatus(order.status);
    if (!next) return;
    setBusyId(order.id);
    setErr('');
    try {
      await api(`/admin/orders/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });
      await load();
    } catch (e: any) {
      setErr(e.message || 'Falha ao atualizar status');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ padding: '24px 0' }}>
      <h1>Admin Schimitz</h1>
      {err ? <div className="alert">{err}</div> : null}
      <h3>Produtos ({products.length})</h3>
      {products.map((p) => (
        <div key={p.id} className="muted">
          {p.sku} — {p.name}
        </div>
      ))}
      <h3 style={{ marginTop: 24 }}>Pedidos ({orders.length})</h3>
      <p className="muted" style={{ fontSize: 14 }}>
        Entrega própria: avance Separando → Saiu para entrega → Entregue (sem Melhor Envio).
      </p>
      {orders.map((o) => {
        const next = nextFulfillmentStatus(o.status);
        return (
          <div key={o.id} className="card" style={{ marginBottom: 10 }}>
            <div className="body row">
              <div>
                <b>{o.publicId}</b>
                <div className="muted">
                  {orderStatusLabel(o.status)} <span style={{ opacity: 0.6 }}>({o.status})</span>
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {brl(o.total)}
                  {o.items?.length ? ` · ${o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}` : ''}
                </div>
              </div>
              {next ? (
                <button
                  className="btn"
                  disabled={busyId === o.id}
                  onClick={() => advance(o)}
                  title={`Avançar para ${orderStatusLabel(next)}`}
                >
                  {busyId === o.id ? 'Salvando...' : `Marcar: ${orderStatusLabel(next)}`}
                </button>
              ) : (
                <span className="badge">{orderStatusLabel(o.status)}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
