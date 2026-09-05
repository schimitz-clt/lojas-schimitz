'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, brl, currentUser } from '@/lib/api';

type Address = { id: string; label: string; street: string; number: string; city: string; uf: string; cep: string };
type Cart = { items: { id: string; name: string; qty: number; price: number; lineTotal: number }[]; subtotal: number };

export default function CheckoutPage() {
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState('');
  const [coupon, setCoupon] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentUser()) {
      router.push('/entrar');
      return;
    }
    api<Cart>('/cart').then(setCart).catch((e) => setErr(e.message));
    api<Address[]>('/me/addresses').then((list) => {
      setAddresses(list);
      if (list[0]) setAddressId(list[0].id);
    }).catch(() => {});
  }, [router]);

  async function submit() {
    if (!addressId) {
      setErr('Cadastre um endereço na conta antes de finalizar.');
      return;
    }
    setLoading(true);
    setErr('');
    try {
      const persistKey = `sch_idem_order:${addressId}:${coupon || ''}`;
      let key = sessionStorage.getItem(persistKey);
      if (!key || key.length < 8) {
        key = crypto.randomUUID();
        sessionStorage.setItem(persistKey, key);
      }
      const order = await api<{ publicId: string }>('/orders', {
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body: JSON.stringify({ addressId, couponCode: coupon || undefined }),
      });
      sessionStorage.removeItem(persistKey);
      router.push(`/pedidos/${order.publicId}`);
    } catch (e: any) {
      setErr(e.message || 'Não foi possível criar o pedido. Preço e estoque são recalculados no servidor.');
    } finally {
      setLoading(false);
    }
  }

  if (!cart) return <p className="muted">Carregando checkout...</p>;
  if (cart.items.length === 0) return <p className="muted">Sacola vazia. Volte ao catálogo.</p>;

  return (
    <div style={{ padding: '24px 0' }}>
      <h1>Checkout</h1>
      <p className="muted">O total é calculado no servidor. O valor da tela é apenas estimativa.</p>
      {err ? <div className="alert">{err}</div> : null}
      {cart.items.map((i) => (
        <div key={i.id} className="card" style={{ marginBottom: 8 }}>
          <div className="body">{i.name} × {i.qty} — {brl(i.lineTotal)}</div>
        </div>
      ))}
      <p>Subtotal estimado {brl(cart.subtotal)}</p>
      <label>Endereço</label>
      <select value={addressId} onChange={(e) => setAddressId(e.target.value)}>
        {addresses.map((a) => (
          <option key={a.id} value={a.id}>{a.label} — {a.street}, {a.number} — {a.city}/{a.uf}</option>
        ))}
      </select>
      <div style={{ marginTop: 12 }}>
        <input placeholder="Cupom (opcional)" value={coupon} onChange={(e) => setCoupon(e.target.value)} />
      </div>
      <button className="btn" disabled={loading} onClick={submit} style={{ marginTop: 16 }}>
        {loading ? 'Criando pedido...' : 'Confirmar e ir ao pagamento'}
      </button>
    </div>
  );
}
