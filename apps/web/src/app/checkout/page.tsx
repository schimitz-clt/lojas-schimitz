'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, brl, currentUser, waLink } from '@/lib/api';
import { pixPrice, pixSavings } from '@/lib/pricing';
import { isMissingOrPlaceholderImage } from '@/lib/placeholder-image';
import { rewritePublicUploadUrl } from '@/lib/public-upload-url';
import {
  CheckoutAddressSection,
  type CheckoutAddress,
} from '@/components/CheckoutAddressSection';
import { TrustBadges } from '@/components/TrustBadges';
import { persistLastOrderPublicId } from '@/lib/order-recovery';

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

const AFTER_STEPS = [
  { title: 'Pagamento', detail: 'PIX ou cartão no próximo passo' },
  { title: 'Pedido confirmado', detail: 'Assim que o pagamento for aprovado' },
  { title: 'Separação', detail: 'Organizamos e embalamos na loja' },
  { title: 'Envio / entrega', detail: 'Entrega própria Schimitz' },
  { title: 'Acompanhamento', detail: 'Status atualizado nesta página' },
] as const;

export default function CheckoutPage() {
  const router = useRouter();
  const errId = useId();
  const submittingRef = useRef(false);
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
    if (submittingRef.current || loading) return;
    if (!addressId) {
      setErr('Salve um endereço de entrega acima para continuar.');
      const el = document.querySelector('.checkout-address');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    submittingRef.current = true;
    setLoading(true);
    setErr('');
    try {
      const cashbackNum = Number(String(cashbackAmount).replace(',', '.')) || 0;
      if (cashbackNum < 0) {
        setErr('Valor de SCHIMITZ+ inválido.');
        return;
      }
      if (loyalty && cashbackNum > loyalty.balance + 0.0001) {
        setErr('Saldo SCHIMITZ+ insuficiente.');
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
      persistLastOrderPublicId(order.publicId, window.localStorage);
      router.push(`/pedidos/${order.publicId}`);
    } catch (e: any) {
      setErr(e.message || 'Não foi possível criar o pedido. Preço e estoque são recalculados no servidor.');
    } finally {
      submittingRef.current = false;
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
  const displayTotal = Math.max(0, cart.subtotal - couponDiscount - cashbackApplied + freightPrice);
  const freightReady = Boolean(freight) && !freightLoading;
  const totalsSettled = freightReady;
  const pixTotal = pixPrice(displayTotal);
  const pixSave = pixSavings(displayTotal);
  const canConfirm = Boolean(addressId) && !loading;
  const supportHref = waLink('Olá! Preciso de ajuda no checkout da Lojas Schimitz.');

  return (
    <div className="checkout-page" style={{ padding: '24px 0' }}>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        <Link href="/carrinho">Sacola</Link> · Checkout
      </p>
      <h1 style={{ marginTop: 8 }}>Checkout</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        Confira o pedido, endereço e frete. O total definitivo é validado no servidor ao criar o pedido.
      </p>

      <section className="checkout-section card" aria-labelledby="checkout-items-heading">
        <div className="body">
          <h2 id="checkout-items-heading" className="checkout-section-title">
            Seu pedido
          </h2>
          <ul className="checkout-items">
            {cart.items.map((i) => {
              const raw = rewritePublicUploadUrl(i.image) || i.image || '';
              const src = raw && !isMissingOrPlaceholderImage(raw) ? raw : '';
              const href = i.slug ? `/produto/${i.slug}` : null;
              return (
                <li key={i.id} className="checkout-line">
                  <div className="checkout-line-media">
                    {src ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt={i.name}
                          width={64}
                          height={64}
                          loading="lazy"
                          decoding="async"
                        />
                      </>
                    ) : (
                      <span className="checkout-line-ph" aria-hidden>
                        SCH
                      </span>
                    )}
                  </div>
                  <div className="checkout-line-body">
                    {href ? (
                      <Link href={href} className="checkout-line-name">
                        {i.name}
                      </Link>
                    ) : (
                      <span className="checkout-line-name">{i.name}</span>
                    )}
                    <div className="checkout-line-meta muted">
                      <span>
                        Qtd. {i.qty} · und. {brl(i.price)}
                      </span>
                      <span className="checkout-line-subtotal">{brl(i.lineTotal)}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

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

      <section className="checkout-section card" aria-labelledby="checkout-freight-heading">
        <div className="body">
          <h2 id="checkout-freight-heading" className="checkout-section-title">
            Entrega
          </h2>
          {freightLoading ? (
            <p className="muted" style={{ marginBottom: 0 }}>
              Calculando frete…
            </p>
          ) : null}
          {freightErr ? (
            <div className="alert" style={{ marginTop: 8 }} role="alert">
              {freightErr}
            </div>
          ) : null}
          {!freightLoading && freight ? (
            <>
              <p style={{ marginBottom: 4 }}>
                <strong>
                  {freight.price === 0 ? 'Frete grátis' : `Frete: ${brl(freight.price)}`}
                </strong>
                {' · '}
                {freight.days} dia{freight.days === 1 ? '' : 's'}
                {freight.modality ? ` · ${freight.modality}` : ''}
              </p>
              <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
                {freight.carrier ? `${freight.carrier}` : 'Entrega própria'}
                {freight.label
                  ? ` · zona ${freight.label}${freight.matchedPrefix ? ` (CEP ${freight.matchedPrefix}…)` : ''}`
                  : freight.matchedPrefix
                    ? ` · regra CEP ${freight.matchedPrefix}…`
                    : ' · taxa padrão da loja (sem zona específica para este CEP).'}
              </p>
            </>
          ) : null}
          {!addressId ? (
            <p className="muted" style={{ marginBottom: 0 }}>
              Salve ou selecione um endereço acima para ver o frete.
            </p>
          ) : null}
        </div>
      </section>

      <div style={{ marginTop: 12 }}>
        <label htmlFor="checkout-coupon">Cupom (opcional)</label>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input
            id="checkout-coupon"
            placeholder="Ex.: PIX5"
            value={coupon}
            onChange={(e) => {
              setCoupon(e.target.value);
              setCouponPreview(null);
              setCouponErr('');
            }}
            style={{ flex: 1, minWidth: 160 }}
            autoComplete="off"
          />
          <button
            type="button"
            className="btn ghost"
            disabled={validating || !coupon.trim()}
            onClick={applyCoupon}
          >
            {validating ? 'Validando...' : 'Aplicar cupom'}
          </button>
        </div>
        {couponErr ? (
          <div className="alert" style={{ marginTop: 8 }} role="alert">
            {couponErr}
          </div>
        ) : null}
      </div>

      {loyalty && loyalty.balance > 0 ? (
        <div style={{ marginTop: 12 }}>
          <label htmlFor="checkout-cashback">Usar SCHIMITZ+ (saldo {brl(loyalty.balance)})</label>
          <input
            id="checkout-cashback"
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

      <section className="checkout-section card checkout-summary" aria-labelledby="checkout-pay-heading">
        <div className="body">
          <h2 id="checkout-pay-heading" className="checkout-section-title">
            Resumo do pagamento
          </h2>
          <dl className="checkout-breakdown">
            <div>
              <dt>Subtotal</dt>
              <dd>{brl(cart.subtotal)}</dd>
            </div>
            {couponPreview ? (
              <div>
                <dt>Cupom {couponPreview.code}</dt>
                <dd className="ok">−{brl(couponPreview.discount)}</dd>
              </div>
            ) : null}
            {cashbackApplied > 0 ? (
              <div>
                <dt>SCHIMITZ+</dt>
                <dd>−{brl(cashbackApplied)}</dd>
              </div>
            ) : null}
            <div>
              <dt>Frete</dt>
              <dd>
                {freightLoading
                  ? '…'
                  : freight
                    ? freight.price === 0
                      ? 'Grátis'
                      : brl(freight.price)
                    : addressId
                      ? '—'
                      : 'Informe o endereço'}
              </dd>
            </div>
            <div className="checkout-breakdown-total">
              <dt>{totalsSettled ? 'Total' : 'Total (aguardando frete)'}</dt>
              <dd>{brl(displayTotal)}</dd>
            </div>
          </dl>

          <div className="checkout-pix-box" aria-label="Desconto PIX">
            <div className="checkout-pix-row">
              <span>
                <strong>PIX 5% OFF</strong>
                <span className="muted" style={{ display: 'block', fontSize: 12 }}>
                  {totalsSettled
                    ? 'Desconto aplicado no pagamento via PIX'
                    : 'Prévia com o total atual (frete ainda não fechado)'}
                </span>
              </span>
              <span className="checkout-pix-prices">
                <s className="muted">{brl(displayTotal)}</s>
                <strong className="checkout-pix-value">{brl(pixTotal)}</strong>
              </span>
            </div>
            {pixSave > 0 ? (
              <p className="checkout-pix-save ok">Você economiza {brl(pixSave)} no PIX</p>
            ) : null}
          </div>

          <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
            No pagamento você escolhe PIX ou cartão. Parcelas do cartão aparecem na etapa seguinte,
            conforme o Mercado Pago.
          </p>
        </div>
      </section>

      <section className="checkout-section" aria-labelledby="checkout-trust-heading">
        <h2 id="checkout-trust-heading" className="checkout-section-title checkout-section-title-plain">
          Compra com tranquilidade
        </h2>
        <TrustBadges variant="checkout" />
      </section>

      <section className="checkout-section card" aria-labelledby="checkout-after-heading">
        <div className="body">
          <h2 id="checkout-after-heading" className="checkout-section-title">
            O que acontece depois
          </h2>
          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
            Jornada típica — não é o status atual do seu pedido.
          </p>
          <ol className="checkout-after-steps">
            {AFTER_STEPS.map((step, idx) => (
              <li key={step.title}>
                <span className="checkout-after-num" aria-hidden>
                  {idx + 1}
                </span>
                <div>
                  <strong>{step.title}</strong>
                  <span className="muted">{step.detail}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {err ? (
        <div className="alert checkout-err" id={errId} role="alert" style={{ marginTop: 12 }}>
          {err}
        </div>
      ) : null}

      <button
        type="button"
        className="btn checkout-confirm-btn"
        disabled={!canConfirm}
        onClick={submit}
        style={{ marginTop: 16, width: '100%', maxWidth: 480, minHeight: 48 }}
        aria-busy={loading || undefined}
        aria-describedby={err ? errId : undefined}
      >
        {loading ? 'Criando pedido…' : 'Confirmar pedido e pagar'}
      </button>
      {!addressId && addressesLoaded ? (
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          O botão libera depois que você salvar um endereço nesta página.
        </p>
      ) : null}

      <p className="checkout-support muted">
        Dúvidas?{' '}
        <a href={supportHref} target="_blank" rel="noopener noreferrer">
          WhatsApp (51) 99625-3766
        </a>
      </p>
    </div>
  );
}
