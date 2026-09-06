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
  const [busyId, setBusyId] = useState<string | null>(null);

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
    setBusyId(id);
    try {
      await api(`/cart/items/${id}`, { method: 'PATCH', body: JSON.stringify({ qty }) });
      await load();
    } finally {
      setBusyId(null);
    }
  }
  async function remove(id: string) {
    setBusyId(id);
    try {
      await api(`/cart/items/${id}`, { method: 'DELETE' });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (err) return <div className="alert" style={{ marginTop: 24 }}>{err}</div>;
  if (!cart) return <p className="muted">Carregando sacola...</p>;

  const hasItems = cart.items.length > 0;

  return (
    <div className="cart-page" style={{ padding: '24px 0' }}>
      <h1 style={{ marginTop: 0 }}>Sacola</h1>
      {!hasItems ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="body">
            <p style={{ margin: '0 0 12px' }} className="muted">Sua sacola está vazia.</p>
            <Link className="btn" href="/produtos">Continuar comprando</Link>
          </div>
        </div>
      ) : null}
      {cart.items.map((i) => (
        <div key={i.id} className="card" style={{ marginBottom: 10 }}>
          <div className="body row" style={{ flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0, flex: '1 1 160px' }}>
              <b>{i.name}</b>
              <div className="muted">{brl(i.price)} × {i.qty}</div>
              <div style={{ fontWeight: 700, marginTop: 4 }}>{brl(i.lineTotal)}</div>
            </div>
            <div className="cart-qty" style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              <button
                className="btn ghost"
                type="button"
                disabled={busyId === i.id || i.qty <= 1}
                onClick={() => change(i.id, Math.max(1, i.qty - 1))}
                aria-label="Diminuir quantidade"
              >
                −
              </button>
              <span style={{ margin: '0 8px', minWidth: 24, textAlign: 'center', fontWeight: 700 }}>{i.qty}</span>
              <button
                className="btn ghost"
                type="button"
                disabled={busyId === i.id}
                onClick={() => change(i.id, i.qty + 1)}
                aria-label="Aumentar quantidade"
              >
                +
              </button>
              <button
                className="btn ghost"
                type="button"
                style={{ marginLeft: 8 }}
                disabled={busyId === i.id}
                onClick={() => remove(i.id)}
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      ))}

      {hasItems ? (
        <>
          <div className="cart-summary card" style={{ marginTop: 16 }}>
            <div className="body">
              <div className="row" style={{ marginBottom: 12 }}>
                <span className="muted">Itens</span>
                <span>{cart.itemCount}</span>
              </div>
              <div className="row" style={{ marginBottom: 16 }}>
                <h3 style={{ margin: 0 }}>Subtotal</h3>
                <h3 style={{ margin: 0 }}>{brl(cart.subtotal)}</h3>
              </div>
              <Link className="btn cart-checkout-btn" href="/checkout">
                Finalizar compra
              </Link>
              <Link className="btn ghost cart-keep-shopping" href="/produtos" style={{ marginTop: 10, display: 'block', textAlign: 'center' }}>
                Continuar comprando
              </Link>
              <p className="muted" style={{ marginBottom: 0, marginTop: 12, fontSize: 13 }}>
                Frete calculado no checkout conforme o CEP (entrega própria). Após confirmar, você paga com PIX ou cartão (Mercado Pago).
              </p>
            </div>
          </div>

          <div className="cart-sticky-checkout" aria-label="Finalizar">
            <div style={{ minWidth: 0 }}>
              <div className="muted" style={{ fontSize: 11 }}>Subtotal</div>
              <div className="price" style={{ fontSize: 16 }}>{brl(cart.subtotal)}</div>
            </div>
            <Link className="btn cart-checkout-btn" href="/checkout">
              Finalizar compra
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
