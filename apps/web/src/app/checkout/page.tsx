'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, brl, currentUser } from '@/lib/api';

type Address = { id: string; label: string; street: string; number: string; city: string; uf: string; cep: string };
type Cart = { items: { id: string; name: string; qty: number; price: number; lineTotal: number }[]; subtotal: number };
type CouponPreview = { code: string; discount: number; finalSubtotal: number };
type Loyalty = { balance: number; label: string; rate: number };

export default function CheckoutPage() {
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState('');
  const [coupon, setCoupon] = useState('');
  const [couponPreview, setCouponPreview] = useState<CouponPreview | null>(null);
  const [couponErr, setCouponErr] = useState('');
  const [loyalty, setLoyalty] = useState<Loyalty | null>(null);
  const [cashbackAmount, setCashbackAmount] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);

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
    api<Loyalty>('/me/loyalty').then(setLoyalty).catch(() => {});
  }, [router]);

  async function applyCoupon() {
    if (!cart || !coupon.trim()) {
      setCouponPreview(null);
      setCouponErr('');
      return;
    }
    setValidating(true);
    setCouponErr('');
    try {
      const data = await api<CouponPreview>('/coupons/validate', {
        method: 'POST',
        body: JSON.stringify({ code: coupon.trim(), subtotal: cart.subtotal }),
      });
      setCouponPreview(data);
    } catch (e: any) {
      setCouponPreview(null);
      setCouponErr(e.message || 'Cupom inválido');
    } finally {
      setValidating(false);
    }
  }

  async function submit() {
    if (!addressId) {
      setErr('Cadastre um endereço na conta antes de finalizar.');
      return;
    }
    setLoading(true);
    setErr('');
    try {
      const cashbackNum = Number(String(cashbackAmount).replace(',', '.')) || 0;
      if (cashbackNum < 0) {
        setErr('Valor de SCHIMITZ+ inválido.');
        setLoading(false);
        return;
      }
      if (loyalty && cashbackNum > loyalty.balance + 0.0001) {
        setErr('Saldo SCHIMITZ+ insuficiente.');
        setLoading(false);
        return;
      }
      const persistKey = `sch_idem_order:${addressId}:${coupon || ''}:${cashbackNum}`;
      let key = sessionStorage.getItem(persistKey);
      if (!key || key.length < 8) {
        key = crypto.randomUUID();
        sessionStorage.setItem(persistKey, key);
      }
      const order = await api<{ publicId: string }>('/orders', {
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body: JSON.stringify({
          addressId,
          couponCode: coupon.trim() || undefined,
          cashbackAmount: cashbackNum > 0 ? cashbackNum : undefined,
        }),
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

  const couponDiscount = couponPreview?.discount ?? 0;
  const cashbackNum = Math.max(0, Number(String(cashbackAmount).replace(',', '.')) || 0);
  const cashbackApplied = Math.min(cashbackNum, Math.max(0, cart.subtotal - couponDiscount));
  const estimated = Math.max(0, cart.subtotal - couponDiscount - cashbackApplied);

  return (
    <div style={{ padding: '24px 0' }}>
      <h1>Checkout</h1>
      <p className="muted">O total é calculado no servidor. O valor da tela é apenas estimativa (frete à parte).</p>
      {err ? <div className="alert">{err}</div> : null}
      {cart.items.map((i) => (
        <div key={i.id} className="card" style={{ marginBottom: 8 }}>
          <div className="body">{i.name} × {i.qty} — {brl(i.lineTotal)}</div>
        </div>
      ))}
      <p>Subtotal estimado {brl(cart.subtotal)}</p>
      {couponPreview ? <p className="ok">Cupom {couponPreview.code}: −{brl(couponPreview.discount)}</p> : null}
      {cashbackApplied > 0 ? <p>SCHIMITZ+: −{brl(cashbackApplied)}</p> : null}
      <p><b>Estimativa (sem frete): {brl(estimated)}</b></p>
      <label>Endereço</label>
      <select value={addressId} onChange={(e) => setAddressId(e.target.value)}>
        {addresses.map((a) => (
          <option key={a.id} value={a.id}>{a.label} — {a.street}, {a.number} — {a.city}/{a.uf}</option>
        ))}
      </select>
      <div style={{ marginTop: 12 }}>
        <label>Cupom (opcional)</label>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input
            placeholder="Ex.: PIX5"
            value={coupon}
            onChange={(e) => {
              setCoupon(e.target.value);
              setCouponPreview(null);
              setCouponErr('');
            }}
            style={{ flex: 1, minWidth: 160 }}
          />
          <button type="button" className="btn ghost" disabled={validating || !coupon.trim()} onClick={applyCoupon}>
            {validating ? 'Validando...' : 'Aplicar cupom'}
          </button>
        </div>
        {couponErr ? <div className="alert" style={{ marginTop: 8 }}>{couponErr}</div> : null}
      </div>
      {loyalty && loyalty.balance > 0 ? (
        <div style={{ marginTop: 12 }}>
          <label>Usar SCHIMITZ+ (saldo {brl(loyalty.balance)})</label>
          <input
            inputMode="decimal"
            placeholder="0,00"
            value={cashbackAmount}
            onChange={(e) => setCashbackAmount(e.target.value)}
          />
          <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            Você pode usar parte do saldo. O restante continua na conta.
          </p>
        </div>
      ) : loyalty ? (
        <p className="muted" style={{ marginTop: 12 }}>
          SCHIMITZ+: ao pagar, você ganha {(loyalty.rate * 100).toFixed(0)}% de cashback no saldo.
        </p>
      ) : null}
      <button className="btn" disabled={loading} onClick={submit} style={{ marginTop: 16 }}>
        {loading ? 'Criando pedido...' : 'Confirmar e ir ao pagamento'}
      </button>
    </div>
  );
}
