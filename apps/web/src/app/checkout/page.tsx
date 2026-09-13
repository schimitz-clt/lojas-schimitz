'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, brl, currentUser } from '@/lib/api';
import { pixPrice } from '@/lib/pricing';
import { isMissingOrPlaceholderImage } from '@/lib/placeholder-image';
import { rewritePublicUploadUrl } from '@/lib/public-upload-url';
import {
  CheckoutAddressSection,
  type CheckoutAddress,
} from '@/components/CheckoutAddressSection';

type CartItem = {
  id: string;
  name: string;
  slug?: string;
  qty: number;
  price: number;
  lineTotal: number;
  image?: string | null;
};
type Cart = { items: CartItem[]; subtotal: number };
type CouponPreview = { code: string; discount: number; finalSubtotal: number };
type Loyalty = { balance: number; label: string; rate: number };
type FreightQuote = {
  price: number;
  days: number;
  carrier: string;
  modality: string;
  matchedPrefix: string | null;
  label: string | null;
  freeAbove: number;
};

export default function CheckoutPage() {
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null>(null);
  const [addresses, setAddresses] = useState<CheckoutAddress[]>([]);
  const [addressId, setAddressId] = useState('');
  const [addressesLoaded, setAddressesLoaded] = useState(false);
  const [coupon, setCoupon] = useState('');
  const [couponPreview, setCouponPreview] = useState<CouponPreview | null>(null);
  const [couponErr, setCouponErr] = useState('');
  const [loyalty, setLoyalty] = useState<Loyalty | null>(null);
  const [cashbackAmount, setCashbackAmount] = useState('');
  const [freight, setFreight] = useState<FreightQuote | null>(null);
  const [freightErr, setFreightErr] = useState('');
  const [freightLoading, setFreightLoading] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    if (!currentUser()) {
      router.push('/entrar');
      return;
    }
    api<Cart>('/cart').then(setCart).catch((e) => setErr(e.message));
    api<CheckoutAddress[]>('/me/addresses')
      .then((list) => {
        setAddresses(list);
        if (list[0]) setAddressId(list[0].id);
      })
      .catch(() => {})
      .finally(() => setAddressesLoaded(true));
    api<Loyalty>('/me/loyalty').then(setLoyalty).catch(() => {});
  }, [router]);

  useEffect(() => {
    if (!cart || !addressId) {
      setFreight(null);
      setFreightErr('');
      return;
    }
    const addr = addresses.find((a) => a.id === addressId);
    if (!addr?.cep) {
      setFreight(null);
      return;
    }
    let cancelled = false;
    setFreightLoading(true);
    setFreightErr('');
    api<FreightQuote>('/shipping/quote', {
      method: 'POST',
      body: JSON.stringify({ cep: addr.cep, subtotal: cart.subtotal }),
    })
      .then((q) => {
        if (!cancelled) setFreight(q);
      })
      .catch((e: any) => {
        if (!cancelled) {
          setFreight(null);
          setFreightErr(e.message || 'Não foi possível calcular o frete');
        }
      })
      .finally(() => {
        if (!cancelled) setFreightLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cart, addressId, addresses]);

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
      setErr('Salve um endereço de entrega acima para continuar.');
      const el = document.querySelector('.checkout-address');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  if (cart.items.length === 0) {
    return (
      <div style={{ padding: '24px 0' }}>
        <p className="muted">Sacola vazia. Volte ao catálogo.</p>
        <Link className="btn" href="/produtos">Continuar comprando</Link>
      </div>
    );
  }

  const couponDiscount = couponPreview?.discount ?? 0;
  const cashbackNum = Math.max(0, Number(String(cashbackAmount).replace(',', '.')) || 0);
  const cashbackApplied = Math.min(cashbackNum, Math.max(0, cart.subtotal - couponDiscount));
  const freightPrice = freight?.price ?? 0;
  const estimated = Math.max(0, cart.subtotal - couponDiscount - cashbackApplied + freightPrice);
  const canConfirm = Boolean(addressId) && !loading;

  return (
    <div className="checkout-page" style={{ padding: '24px 0' }}>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        <Link href="/carrinho">Sacola</Link> · Checkout
      </p>
      <h1 style={{ marginTop: 8 }}>Checkout</h1>
      <p className="muted">
        Cadastre ou escolha o endereço aqui, veja o frete e confirme. O total definitivo é validado no servidor.
      </p>
      {err ? <div className="alert">{err}</div> : null}
      {cart.items.map((i) => {
        const raw = rewritePublicUploadUrl(i.image) || i.image || '';
        const src = raw && !isMissingOrPlaceholderImage(raw) ? raw : '';
        const href = i.slug ? `/produto/${i.slug}` : null;
        return (
          <div key={i.id} className="card" style={{ marginBottom: 8 }}>
            <div className="body checkout-line">
              <div className="checkout-line-media" aria-hidden>
                {src ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" width={48} height={48} loading="lazy" decoding="async" />
                  </>
                ) : (
                  <span style={{ fontSize: 9, fontWeight: 800, textAlign: 'center', color: 'var(--muted)' }}>
                    SCH
                  </span>
                )}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                {href ? (
                  <Link href={href} style={{ fontWeight: 700 }}>
                    {i.name}
                  </Link>
                ) : (
                  <b>{i.name}</b>
                )}
                <div className="muted" style={{ fontSize: 13 }}>
                  {i.qty} × {brl(i.price)} — {brl(i.lineTotal)}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <p>Subtotal estimado {brl(cart.subtotal)}</p>
      <p className="muted" style={{ marginTop: -8, fontSize: 13 }}>
        No PIX (5% OFF no pagamento): <strong style={{ color: 'var(--ink)' }}>{brl(pixPrice(cart.subtotal))}</strong>
      </p>
      {couponPreview ? <p className="ok">Cupom {couponPreview.code}: −{brl(couponPreview.discount)}</p> : null}
      {cashbackApplied > 0 ? <p>SCHIMITZ+: −{brl(cashbackApplied)}</p> : null}

      {addressesLoaded ? (
        <CheckoutAddressSection
          addresses={addresses}
          addressId={addressId}
          onAddressesChange={(list, selectedId) => {
            setAddresses(list);
            setAddressId(selectedId);
            setErr('');
          }}
          onAddressIdChange={(id) => {
            setAddressId(id);
            setErr('');
          }}
        />
      ) : (
        <p className="muted">Carregando endereços…</p>
      )}

      <div className="card" style={{ marginTop: 12, marginBottom: 8 }}>
        <div className="body">
          <b>Frete (entrega própria)</b>
          {freightLoading ? <p className="muted" style={{ marginBottom: 0 }}>Calculando frete...</p> : null}
          {freightErr ? <div className="alert" style={{ marginTop: 8 }}>{freightErr}</div> : null}
          {!freightLoading && freight ? (
            <>
              <p style={{ marginBottom: 4 }}>
                {freight.price === 0
                  ? 'Frete grátis'
                  : `Frete: ${brl(freight.price)}`}
                {' · '}
                prazo estimado: {freight.days} dia{freight.days === 1 ? '' : 's'}
              </p>
              <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
                {freight.label
                  ? `Zona: ${freight.label}${freight.matchedPrefix ? ` (CEP ${freight.matchedPrefix}…)` : ''}`
                  : freight.matchedPrefix
                    ? `Regra de CEP ${freight.matchedPrefix}…`
                    : 'Taxa padrão da loja (sem zona específica para este CEP).'}
              </p>
            </>
          ) : null}
          {!addressId ? (
            <p className="muted" style={{ marginBottom: 0 }}>
              Salve ou selecione um endereço acima para ver o frete.
            </p>
          ) : null}
        </div>
      </div>
      <p><b>Estimativa total: {brl(estimated)}</b></p>
      <p className="muted" style={{ marginTop: -8, fontSize: 13 }}>
        Se pagar com PIX: ~{brl(pixPrice(estimated))} (5% OFF no pagamento; frete e cupom já na estimativa)
      </p>
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
      <button
        className="btn checkout-confirm-btn"
        disabled={!canConfirm}
        onClick={submit}
        style={{ marginTop: 16, width: '100%', maxWidth: 420 }}
      >
        {loading ? 'Criando pedido...' : 'Confirmar e ir ao pagamento'}
      </button>
      {!addressId && addressesLoaded ? (
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          O botão libera depois que você salvar um endereço nesta página.
        </p>
      ) : null}
    </div>
  );
}
