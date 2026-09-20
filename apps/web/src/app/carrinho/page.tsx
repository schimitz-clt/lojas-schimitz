'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, brl, getGuestToken } from '@/lib/api';
import { useSessionUser } from '@/lib/use-session-user';
import { cartCheckoutHref } from '@/lib/checkout-auth';
import {
  CheckoutAddressSection,
  type CheckoutAddress,
} from '@/components/CheckoutAddressSection';
import { pixPrice, stockBadge } from '@/lib/pricing';
import { cartCheckoutLabel, cartTrustItems, pixHighlight } from '@/lib/storefront-pro';
import { isMissingOrPlaceholderImage } from '@/lib/placeholder-image';
import { rewritePublicUploadUrl } from '@/lib/public-upload-url';
import { mixedCartBlockMessagePt, isMixedSellerCart } from '@/lib/mixed-cart';
import { CartCouponField } from '@/components/CartCouponField';
import { cartDiscountAmount, cartPayableTotal } from '@/lib/cart-coupon';
import { isPixPromoCollidingCouponCode } from '@/lib/pricing';

type CartItem = {
  id: string;
  productId: string;
  name: string;
  slug?: string;
  qty: number;
  price: number;
  lineTotal: number;
  image?: string | null;
  stock?: number | null;
  sellerId?: string | null;
  seller?: { id: string; name: string; slug: string } | null;
};

type Cart = {
  id: string;
  guestToken?: string | null;
  items: CartItem[];
  subtotal: number;
  discount?: number;
  total?: number;
  coupon?: { code: string; discount: number; finalSubtotal: number; collidesWithPixPromo?: boolean } | null;
  couponError?: { code: string; message: string } | null;
  itemCount: number;
  mixedSellers?: boolean;
};

function CartThumb({ item }: { item: CartItem }) {
  const raw = rewritePublicUploadUrl(item.image) || item.image || '';
  const src = raw && !isMissingOrPlaceholderImage(raw) ? raw : '';
  if (!src) {
    return (
      <div className="cart-line-media" aria-hidden>
        <span className="cart-line-ph">
          LOJAS <em>SCHIMITZ</em>
        </span>
      </div>
    );
  }
  return (
    <div className="cart-line-media">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        width={72}
        height={72}
        loading="lazy"
        decoding="async"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
    </div>
  );
}

export default function CartPage() {
  const { user, ready: sessionReady } = useSessionUser();
  const [cart, setCart] = useState<Cart | null>(null);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState('');
  const [addresses, setAddresses] = useState<CheckoutAddress[]>([]);
  const [addressId, setAddressId] = useState('');
  const [addressesLoaded, setAddressesLoaded] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponErr, setCouponErr] = useState('');

  async function load() {
    getGuestToken();
    try {
      const data = await api<Cart>('/cart');
      if (data.guestToken) localStorage.setItem('sch_guest', data.guestToken);
      setCart(data);
      setErr('');
      setCouponErr(data.couponError?.message || '');
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function loadAddresses() {
    if (!user) {
      setAddressesLoaded(true);
      return;
    }
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
  }, []);

  useEffect(() => {
    if (!sessionReady) return;
    setAddressesLoaded(false);
    void loadAddresses();
  }, [sessionReady, user]);

  async function change(id: string, qty: number) {
    setBusyId(id);
    setActionErr('');
    try {
      await api(`/cart/items/${id}`, { method: 'PATCH', body: JSON.stringify({ qty }) });
      await load();
      try {
        window.dispatchEvent(new Event('sch-cart-updated'));
      } catch {
        /* ignore */
      }
    } catch (e: any) {
      setActionErr(e.message || 'Não foi possível atualizar a quantidade');
    } finally {
      setBusyId(null);
    }
  }
  async function remove(id: string) {
    setBusyId(id);
    setActionErr('');
    try {
      await api(`/cart/items/${id}`, { method: 'DELETE' });
      await load();
      try {
        window.dispatchEvent(new Event('sch-cart-updated'));
      } catch {
        /* ignore */
      }
    } catch (e: any) {
      setActionErr(e.message || 'Não foi possível remover o item');
    } finally {
      setBusyId(null);
    }
  }

  async function applyCoupon() {
    if (!couponInput.trim()) return;
    setCouponBusy(true);
    setCouponErr('');
    try {
      const data = await api<Cart>('/cart/coupon', {
        method: 'POST',
        body: JSON.stringify({ code: couponInput.trim() }),
      });
      setCart(data);
      setCouponInput('');
      setCouponErr(data.couponError?.message || '');
    } catch (e: any) {
      setCouponErr(e.message || 'Cupom inválido');
    } finally {
      setCouponBusy(false);
    }
  }

  async function removeCoupon() {
    setCouponBusy(true);
    setCouponErr('');
    try {
      const data = await api<Cart>('/cart/coupon', { method: 'DELETE' });
      setCart(data);
      setCouponInput('');
    } catch (e: any) {
      setCouponErr(e.message || 'Não foi possível remover o cupom');
    } finally {
      setCouponBusy(false);
    }
  }

  if (err) return <div className="alert" style={{ marginTop: 24 }}>{err}</div>;
  if (!cart) {
    return (
      <div className="cart-page sf-pro-cart" style={{ padding: '24px 0' }}>
        <h1 style={{ marginTop: 0 }}>Sacola</h1>
        <div className="card skel-card" aria-busy="true" aria-label="Carregando sacola">
          <div className="body" style={{ display: 'grid', gap: 10 }}>
            <div className="skel" style={{ height: 18, width: '40%' }} />
            <div className="skel" style={{ height: 72, width: '100%' }} />
            <div className="skel" style={{ height: 72, width: '100%' }} />
          </div>
        </div>
      </div>
    );
  }

  const hasItems = cart.items.length > 0;
  const couponDiscount = cartDiscountAmount(cart.coupon, cart.discount);
  const payable = cartPayableTotal(cart.subtotal, couponDiscount);
  const skipAutoPix = Boolean(
    cart.coupon?.collidesWithPixPromo || isPixPromoCollidingCouponCode(cart.coupon?.code),
  );
  const pixSubtotal = skipAutoPix ? payable : pixPrice(payable);
  const loggedIn = Boolean(user);
  const checkoutHref = cartCheckoutHref(loggedIn);
  const mixedCart = isMixedSellerCart(cart.items, cart.mixedSellers);

  return (
    <div className="cart-page sf-pro-cart" style={{ padding: '24px 0' }}>
      <h1 style={{ marginTop: 0 }}>Sacola</h1>
      {actionErr ? <div className="alert" style={{ marginBottom: 12 }}>{actionErr}</div> : null}
      {mixedCart ? (
        <div className="alert" role="alert" style={{ marginBottom: 12 }}>
          {mixedCartBlockMessagePt(cart.items)}
        </div>
      ) : null}
      {!hasItems ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="body">
            <p style={{ margin: '0 0 8px', fontWeight: 700 }}>Sua sacola está vazia</p>
            <p className="muted" style={{ margin: '0 0 12px', fontSize: 14 }}>
              Explore o catálogo e adicione produtos para ver frete e pagamento no checkout.
            </p>
            <Link className="btn" href="/produtos">
              Continuar comprando
            </Link>
          </div>
        </div>
      ) : null}
      {cart.items.map((i) => {
        const sb = stockBadge(i.stock);
        const overStock =
          typeof i.stock === 'number' && i.stock >= 0 && i.qty > i.stock;
        const href = i.slug ? `/produto/${i.slug}` : null;
        return (
          <div key={i.id} className="card" style={{ marginBottom: 10 }}>
            <div className="body">
              <div className="cart-line">
                {href ? (
                  <Link href={href} aria-label={`Ver ${i.name}`}>
                    <CartThumb item={i} />
                  </Link>
                ) : (
                  <CartThumb item={i} />
                )}
                <div className="cart-line-body">
                  {href ? (
                    <Link href={href} className="cart-line-title">
                      {i.name}
                    </Link>
                  ) : (
                    <b>{i.name}</b>
                  )}
                  <div className="muted" style={{ marginTop: 2 }}>
                    {brl(i.price)} × {i.qty}
                    {i.seller?.name ? ` · ${i.seller.name}` : ''}
                  </div>
                  <div style={{ fontWeight: 700, marginTop: 4 }}>{brl(i.lineTotal)}</div>
                  {sb ? (
                    <p className="muted" style={{ margin: '6px 0 0', fontSize: 12 }}>
                      {sb.label}
                      {typeof i.stock === 'number' && i.stock > 0 ? ` · ${i.stock} disponíveis` : ''}
                    </p>
                  ) : null}
                  {overStock ? (
                    <p className="alert" style={{ margin: '8px 0 0', fontSize: 13 }}>
                      Quantidade acima do estoque. Ajuste antes de finalizar.
                    </p>
                  ) : null}
                </div>
              </div>
              <div
                className="cart-qty"
                style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginTop: 12 }}
              >
                <button
                  className="btn ghost"
                  type="button"
                  disabled={busyId === i.id || i.qty <= 1}
                  onClick={() => change(i.id, Math.max(1, i.qty - 1))}
                  aria-label="Diminuir quantidade"
                >
                  −
                </button>
                <span style={{ margin: '0 8px', minWidth: 24, textAlign: 'center', fontWeight: 700 }}>
                  {i.qty}
                </span>
                <button
                  className="btn ghost"
                  type="button"
                  disabled={
                    busyId === i.id ||
                    (typeof i.stock === 'number' && i.stock >= 0 && i.qty >= i.stock)
                  }
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
        );
      })}

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

          {sessionReady && !loggedIn && addressesLoaded ? (
            <div className="card" style={{ marginTop: 12, marginBottom: 8 }}>
              <div className="body">
                <b>Endereço de entrega</b>
                <p className="muted" style={{ margin: '8px 0 12px', fontSize: 14 }}>
                  Entre ou crie a conta na hora de finalizar — não precisa cadastrar só para olhar a
                  loja.
                </p>
                <Link className="btn" href={checkoutHref}>
                  Entrar ou cadastrar
                </Link>
              </div>
            </div>
          ) : null}

          <div className="cart-summary card" style={{ marginTop: 16 }}>
            <div className="body">
              <div className="row" style={{ marginBottom: 12 }}>
                <span className="muted">Itens</span>
                <span>{cart.itemCount}</span>
              </div>
              <CartCouponField
                id="cart-coupon"
                value={couponInput}
                onChange={setCouponInput}
                applied={cart.coupon ? { code: cart.coupon.code, discount: couponDiscount } : null}
                error={couponErr}
                busy={couponBusy}
                onApply={applyCoupon}
                onRemove={removeCoupon}
              />
              <div className="row" style={{ marginBottom: 8, marginTop: 12 }}>
                <h3 style={{ margin: 0 }}>Subtotal</h3>
                <h3 style={{ margin: 0 }}>{brl(cart.subtotal)}</h3>
              </div>
              {cart.coupon ? (
                <div className="row" style={{ marginBottom: 8 }}>
                  <span>Cupom {cart.coupon.code}</span>
                  <span className="ok">−{brl(couponDiscount)}</span>
                </div>
              ) : null}
              {couponDiscount > 0 ? (
                <div className="row" style={{ marginBottom: 8 }}>
                  <h3 style={{ margin: 0 }}>Total</h3>
                  <h3 style={{ margin: 0 }}>{brl(payable)}</h3>
                </div>
              ) : null}
              <p className="cart-pix-hint">
                No PIX: <strong>{brl(pixSubtotal)}</strong>
                {skipAutoPix
                  ? ' · este cupom já cobre o 5% PIX'
                  : pixHighlight(payable).savings > 0
                    ? ` · ${pixHighlight(payable).savingsLine}`
                    : ' · 5% OFF aplicado no pagamento'}
              </p>
              <ul className="cart-trust" aria-label="Por que comprar aqui">
                {cartTrustItems().map((item) => (
                  <li key={item.title}>
                    <div>
                      <strong>{item.title}</strong>
                      <span className="muted">{item.sub}</span>
                    </div>
                  </li>
                ))}
              </ul>
              {loggedIn && !addressId ? (
                <p className="muted" style={{ marginTop: 0, marginBottom: 12, fontSize: 13 }}>
                  Cadastre o endereço acima (ou no próximo passo) para calcular frete e pagar.
                </p>
              ) : null}
              {mixedCart ? (
                <button className="btn cart-checkout-btn" type="button" disabled>
                  {cartCheckoutLabel(loggedIn)}
                </button>
              ) : (
                <Link className="btn cart-checkout-btn" href={checkoutHref}>
                  {cartCheckoutLabel(loggedIn)}
                </Link>
              )}
              <Link
                className="btn ghost cart-keep-shopping"
                href="/produtos"
                style={{ marginTop: 10, display: 'block', textAlign: 'center' }}
              >
                Continuar comprando
              </Link>
              <p className="muted" style={{ marginBottom: 0, marginTop: 12, fontSize: 13 }}>
                Frete calculado no checkout conforme o CEP (entrega própria). Após confirmar, você
                paga com PIX ou cartão (Mercado Pago).
              </p>
            </div>
          </div>

          <div className="cart-sticky-checkout" aria-label="Finalizar">
            <div style={{ minWidth: 0 }}>
              <div className="muted" style={{ fontSize: 11 }}>
                {couponDiscount > 0 ? 'Total' : 'Subtotal'}
              </div>
              <div className="price" style={{ fontSize: 16 }}>
                {brl(payable)}
              </div>
            </div>
            {mixedCart ? (
              <button className="btn cart-checkout-btn" type="button" disabled>
                {cartCheckoutLabel(loggedIn)}
              </button>
            ) : (
              <Link className="btn cart-checkout-btn" href={checkoutHref}>
                {cartCheckoutLabel(loggedIn)}
              </Link>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
