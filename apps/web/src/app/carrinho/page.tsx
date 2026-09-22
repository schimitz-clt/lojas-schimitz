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
import { isPixPromoCollidingCouponCode, pixPrice, stockBadge } from '@/lib/pricing';
import { cartCheckoutLabel, cartTrustItems, pixHighlight } from '@/lib/storefront-pro';
import { isMissingOrPlaceholderImage } from '@/lib/placeholder-image';
import { rewritePublicUploadUrl } from '@/lib/public-upload-url';
import { mixedCartBlockMessagePt, isMixedSellerCart } from '@/lib/mixed-cart';
import { CartCouponField } from '@/components/CartCouponField';
import { cartDiscountAmount, cartPayableTotal } from '@/lib/cart-coupon';
import { cartEmptyCopy, cartFreightNote, cartLinePriceView } from '@/lib/cart-ux';
import { DEMO_PURCHASE_BLOCK_MESSAGE, cartHasDemoItem } from '@/lib/demo-catalog';

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
  isDemo?: boolean | null;
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

function CartLinePrices({
  unitPrice,
  qty,
  lineTotal,
  skipPixPromo,
}: {
  unitPrice: number;
  qty: number;
  lineTotal: number;
  skipPixPromo: boolean;
}) {
  const view = cartLinePriceView(unitPrice, qty, lineTotal, { skipPixPromo });
  return (
    <div className="cart-line-prices">
      {view.pix != null ? (
        <p className="cart-line-pix">
          <strong>{brl(view.pix)}</strong>
          <span>{view.pixSuffix}</span>
          {view.tag ? <span className="pcard-pix-tag">{view.tag}</span> : null}
        </p>
      ) : (
        <p className="cart-line-pix">
          <strong>{brl(view.list)}</strong>
        </p>
      )}
      {view.orList ? <p className="cart-line-or">{view.orList}</p> : null}
      {view.install ? <p className="pcard-install">{view.install}</p> : null}
      {view.unitHint ? <p className="muted cart-line-unit">{view.unitHint}</p> : null}
    </div>
  );
}

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
        width={96}
        height={96}
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
      <div className="cart-page sf-pro-cart" style={{ paddingTop: 24 }}>
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
  const demoCart = cartHasDemoItem(cart.items);
  const emptyCopy = cartEmptyCopy();
  const freightNote = cartFreightNote();

  return (
    <div className="cart-page sf-pro-cart" style={{ paddingTop: 24 }}>
      <h1 style={{ marginTop: 0 }}>
        Sacola
        {hasItems ? <span className="cart-heading-count"> ({cart.itemCount})</span> : null}
      </h1>
      {actionErr ? <div className="alert" style={{ marginBottom: 12 }}>{actionErr}</div> : null}
      {mixedCart ? (
        <div className="alert" role="alert" style={{ marginBottom: 12 }}>
          {mixedCartBlockMessagePt(cart.items)}
        </div>
      ) : null}
      {demoCart ? (
        <div className="alert" role="alert" style={{ marginBottom: 12 }}>
          {DEMO_PURCHASE_BLOCK_MESSAGE}
        </div>
      ) : null}
      {!hasItems ? (
        <div className="card cart-empty">
          <div className="body">
            <p className="cart-empty-mark" aria-hidden>
              LOJAS <em>SCHIMITZ</em>
            </p>
            <h2 className="cart-empty-title">{emptyCopy.title}</h2>
            <p className="muted cart-empty-body">{emptyCopy.body}</p>
            <div className="cart-empty-actions">
              <Link className="btn" href={emptyCopy.catalogHref}>
                {emptyCopy.catalogLabel}
              </Link>
              <Link className="btn ghost" href={emptyCopy.homeHref}>
                {emptyCopy.homeLabel}
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="cart-layout">
          <div className="cart-main">
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
                          <span className="cart-line-title">{i.name}</span>
                        )}
                        {i.seller?.name ? (
                          <p className="cart-line-seller muted">Vendido por {i.seller.name}</p>
                        ) : null}
                        <CartLinePrices
                          unitPrice={i.price}
                          qty={i.qty}
                          lineTotal={i.lineTotal}
                          skipPixPromo={skipAutoPix}
                        />
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
                    <div className="cart-line-actions">
                      <div className="cart-stepper" aria-label="Quantidade">
                        <button
                          className="btn ghost"
                          type="button"
                          disabled={busyId === i.id || i.qty <= 1}
                          onClick={() => change(i.id, Math.max(1, i.qty - 1))}
                          aria-label="Diminuir quantidade"
                        >
                          −
                        </button>
                        <span className="cart-stepper-qty">{i.qty}</span>
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
                      </div>
                      <button
                        className="btn ghost cart-remove"
                        type="button"
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

            {loggedIn && addressesLoaded ? (
              <div className="cart-address">
                <CheckoutAddressSection
                  addresses={addresses}
                  addressId={addressId}
                  onAddressesChange={(list, selectedId) => {
                    setAddresses(list);
                    setAddressId(selectedId);
                  }}
                  onAddressIdChange={setAddressId}
                />
              </div>
            ) : null}

            <section className="cart-freight card" aria-label={freightNote.title}>
              <div className="body">
                <h2 className="cart-freight-title">{freightNote.title}</h2>
                <p className="cart-freight-body">{freightNote.body}</p>
                {sessionReady && !loggedIn && addressesLoaded ? (
                  <p className="muted cart-freight-pay">
                    Entre ou crie a conta na hora de finalizar — não precisa cadastrar só para olhar a
                    loja.
                  </p>
                ) : null}
                {loggedIn && addressesLoaded && !addressId ? (
                  <p className="muted cart-freight-pay">
                    Cadastre o endereço acima (ou no próximo passo) para calcular frete e pagar.
                  </p>
                ) : null}
                <p className="muted cart-freight-pay">{freightNote.pay}</p>
              </div>
            </section>
          </div>

          <aside className="cart-side">
            <div className="cart-summary card">
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
                <Link
                  className="btn ghost cart-keep-shopping"
                  href="/produtos"
                  style={{ marginTop: 10, display: 'block', textAlign: 'center' }}
                >
                  Continuar comprando
                </Link>
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
                {pixSubtotal < payable ? (
                  <div className="cart-sticky-pix">{brl(pixSubtotal)} no PIX</div>
                ) : null}
              </div>
              {mixedCart || demoCart ? (
                <button className="btn cart-checkout-btn" type="button" disabled>
                  {cartCheckoutLabel(loggedIn)}
                </button>
              ) : (
                <Link className="btn cart-checkout-btn" href={checkoutHref}>
                  {cartCheckoutLabel(loggedIn)}
                </Link>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
