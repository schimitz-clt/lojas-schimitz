'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, brl, currentUser, getGuestToken } from '@/lib/api';
import {
  CheckoutAddressSection,
  type CheckoutAddress,
} from '@/components/CheckoutAddressSection';

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
  const [loggedIn, setLoggedIn] = useState(false);
  const [addresses, setAddresses] = useState<CheckoutAddress[]>([]);
  const [addressId, setAddressId] = useState('');
  const [addressesLoaded, setAddressesLoaded] = useState(false);

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

  async function loadAddresses() {
    if (!currentUser()) {
      setLoggedIn(false);
      setAddressesLoaded(true);
      return;
    }
    setLoggedIn(true);
    try {
      const list = await api<CheckoutAddress[]>('/me/addresses');
      setAddresses(list);
      if (list[0]) setAddressId(list[0].id);
    } catch {
      /* ignore — form still available after login path */
    } finally {
      setAddressesLoaded(true);
    }
  }

  useEffect(() => {
    load();
    loadAddresses();
  }, []);

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
          {loggedIn && addressesLoaded ? (
            <CheckoutAddressSection
              addresses={addresses}
              addressId={addressId}
              onAddressesChange={(list, selectedId) => {
                setAddresses(list);
                setAddressId(selectedId);
              }}
              onAddressIdChange={setAddressId}
            />
          ) : null}

          {!loggedIn && addressesLoaded ? (
            <div className="card" style={{ marginTop: 12, marginBottom: 8 }}>
              <div className="body">
                <b>Endereço de entrega</b>
                <p className="muted" style={{ margin: '8px 0 12px', fontSize: 14 }}>
                  Entre na conta para cadastrar o endereço e calcular o frete no checkout.
                </p>
                <Link className="btn" href="/entrar">Entrar para continuar</Link>
              </div>
            </div>
          ) : null}

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
              {loggedIn && !addressId ? (
                <p className="muted" style={{ marginTop: 0, marginBottom: 12, fontSize: 13 }}>
                  Cadastre o endereço acima (ou no próximo passo) para calcular frete e pagar.
                </p>
              ) : null}
              <Link className="btn cart-checkout-btn" href={loggedIn ? '/checkout' : '/entrar'}>
                {loggedIn ? 'Finalizar compra' : 'Entrar e finalizar'}
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
            <Link className="btn cart-checkout-btn" href={loggedIn ? '/checkout' : '/entrar'}>
              {loggedIn ? 'Finalizar compra' : 'Entrar e finalizar'}
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
