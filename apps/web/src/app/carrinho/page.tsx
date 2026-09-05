'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, brl, getGuestToken } from '@/lib/api';

type Cart = {
  id: string;
  guestToken?: string | null;
  items: { id: string; productId: string; name: string; qty: number; price: number; lineTotal: number; image?: string | null }[];
  subtotal: number;
  itemCount: number;
};

export default function CartPage() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [err, setErr] = useState('');

  async function load() {
    getGuestToken();
    try {
      const data = await api<Cart>('/cart');
      if (data.guestToken) localStorage.setItem('sch_guest', data.guestToken);
      setCart(data);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  useEffect(() => { load(); }, []);

  async function change(id: string, qty: number) {
    await api(`/cart/items/${id}`, { method: 'PATCH', body: JSON.stringify({ qty }) });
    load();
  }
  async function remove(id: string) {
    await api(`/cart/items/${id}`, { method: 'DELETE' });
    load();
  }

  if (err) return <div className="alert" style={{ marginTop: 24 }}>{err}</div>;
  if (!cart) return <p className="muted">Carregando sacola...</p>;

  return (
    <div style={{ padding: '24px 0' }}>
      <h1>Sacola</h1>
      {cart.items.length === 0 ? <p className="muted">Sua sacola está vazia.</p> : null}
      {cart.items.map((i) => (
        <div key={i.id} className="card" style={{ marginBottom: 10 }}>
          <div className="body row">
            <div>
              <b>{i.name}</b>
              <div className="muted">{brl(i.price)} × {i.qty}</div>
            </div>
            <div>
              <button className="btn ghost" onClick={() => change(i.id, Math.max(1, i.qty - 1))}>-</button>
              <span style={{ margin: '0 8px' }}>{i.qty}</span>
              <button className="btn ghost" onClick={() => change(i.id, i.qty + 1)}>+</button>
              <button className="btn ghost" style={{ marginLeft: 8 }} onClick={() => remove(i.id)}>Remover</button>
            </div>
          </div>
        </div>
      ))}
      <div className="row">
        <h3>Subtotal {brl(cart.subtotal)}</h3>
        <Link className="btn" href="/checkout">Finalizar pedido</Link>
      </div>
      <p className="muted">Frete grátis acima de R$ 299. Após confirmar o pedido, você paga com PIX ou cartão (Mercado Pago).</p>
    </div>
  );
}
