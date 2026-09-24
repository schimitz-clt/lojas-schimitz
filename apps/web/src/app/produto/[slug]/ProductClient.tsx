'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, brl, currentUser, getGuestToken, waLink } from '@/lib/api';
import {
  installmentLine,
  installmentSuffix,
  installmentTableNote,
  installmentValue,
  MAX_INSTALLMENTS,
  pixPrice,
} from '@/lib/pricing';
import { pdpDescriptionNeedsCollapse, pdpOfferPills, productDescriptionText } from '@/lib/pdp-offer';
import { pdpSharePixLabel } from '@/lib/pdp-share';
import { PdpSkeleton } from '@/components/Skeleton';
import { buyNowLabel, pdpBuyNowHref, pixHighlight } from '@/lib/storefront-pro';
import { buildProductGallery } from '@/lib/product-gallery';
import { resolveProductStock } from '@/lib/product-media';
import { ProductGallery } from '@/components/ProductGallery';
import { CompareToggle } from '@/components/compare/CompareToggle';
import { FavoriteToggle } from '@/components/favorites/FavoriteToggle';
import { RecentlyViewedStrip } from '@/components/RecentlyViewedStrip';
import { rememberProductView } from '@/lib/recently-viewed';
import { recordAbandonedProductView } from '@/lib/abandoned-product-view';
import { ProductShareButton, ProductWhatsAppShareButton } from '@/components/ProductShareButton';
import { PdpFreightCep } from '@/components/PdpFreightCep';
import { PdpRelatedProducts } from '@/components/PdpRelatedProducts';
import type { Product } from '@/components/ProductCard';
import { DEMO_PURCHASE_BLOCK_MESSAGE, DEMO_SEAL_LABEL, isDemoCatalogProduct } from '@/lib/demo-catalog';
import { scheduleAfterFirstPaint } from '@/lib/navigation-progress';
import {
  pdpBenefitTrustItems,
  pdpCompactTrustChips,
  pdpLowStockUrgency,
  pdpPriceTrustLines,
  pdpStockLine,
  type RelatedKind,
} from '@/lib/pdp-trust';

export type ProductDetail = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: string | number;
  compareAtPrice?: string | number | null;
  badge?: string | null;
  ratingAvg?: string | number;
  ratingCount?: number;
  images?: { id?: string; url: string; position?: number; alt?: string }[];
  stock?: number | null;
  image?: string | null;
  imageUrl?: string | null;
  inventory?: { qtyOnHand?: number; qtyReserved?: number; available?: number | null } | null;
  seller?: { id: string; name: string; slug: string } | null;
  category?: { slug: string; name: string } | null;
  sku?: string | null;
  isDemo?: boolean | null;
  weightKg?: number | string | null;
  widthCm?: number | string | null;
  heightCm?: number | string | null;
  lengthCm?: number | string | null;
};

type Review = {
  id: string;
  rating: number;
  body: string;
  createdAt: string;
  updatedAt?: string;
  user: { id?: string; name: string };
};

type Eligibility = {
  hasPurchased: boolean;
  canReview: boolean;
  myReview: Review | null;
};

function positiveMeasure(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.replace(',', '.')) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function Stars({
  value,
  onChange,
  size = 22,
}: {
  value: number;
  onChange?: (n: number) => void;
  size?: number;
}) {
  return (
    <span style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }} aria-label={`${value} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        const common = {
          fontSize: size,
          lineHeight: 1,
          color: filled ? 'var(--gold)' : 'var(--muted)',
          background: 'none',
          border: 0,
          padding: 0,
          cursor: onChange ? 'pointer' : 'default',
        } as const;
        if (onChange) {
          return (
            <button
              key={n}
              type="button"
              style={common}
              onClick={() => onChange(n)}
              aria-label={`${n} estrela${n > 1 ? 's' : ''}`}
            >
              ★
            </button>
          );
        }
        return (
          <span key={n} style={common}>
            ★
          </span>
        );
      })}
    </span>
  );
}

function formatReviewDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'America/Sao_Paulo',
    });
  } catch {
    return '';
  }
}

export default function ProductPage({
  initial = null,
  related = null,
  relatedKind = null,
  relatedSlot = null,
}: {
  initial?: ProductDetail | null;
  related?: Product[] | null;
  relatedKind?: RelatedKind | null;
  /** Streamed related shelf. When set, it replaces the inline rail so the product is not blocked on that fetch. */
  relatedSlot?: ReactNode;
}) {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const appliedSlug = useRef<string | null>(null);
  const [p, setP] = useState<ProductDetail | null>(() =>
    initial && (!slug || initial.slug === slug) ? initial : null,
  );
  const [reviews, setReviews] = useState<Review[]>([]);
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [savingReview, setSavingReview] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [addedToBag, setAddedToBag] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showBagToast, setShowBagToast] = useState(false);
  const [descOpen, setDescOpen] = useState(false);

  const loadReviews = useCallback(async (productId: string) => {
    const list = await api<Review[]>(`/products/${productId}/reviews`);
    setReviews(list);
  }, []);

  const loadEligibility = useCallback(async (productId: string) => {
    const u = currentUser();
    if (!u) {
      setEligibility(null);
      return;
    }
    try {
      const data = await api<Eligibility>(`/products/${productId}/reviews/me`);
      setEligibility(data);
      if (data.myReview) {
        setRating(data.myReview.rating);
        setBody(data.myReview.body || '');
      }
    } catch {
      setEligibility(null);
    }
  }, []);

  useEffect(() => {
    if (!showBagToast) return;
    const t = window.setTimeout(() => setShowBagToast(false), 6000);
    return () => window.clearTimeout(t);
  }, [showBagToast]);

  useEffect(() => {
    if (!initial || !slug || initial.slug !== slug) return;
    if (appliedSlug.current === slug) return;
    appliedSlug.current = slug;
    setP(initial);
  }, [initial, slug]);

  useEffect(() => {
    getGuestToken();
    setAddedToBag(false);
    setShowBagToast(false);
    setDescOpen(false);
    setMsg('');
    setErr('');
    let cancelled = false;
    const primed = Boolean(initial && (!slug || initial.slug === slug));
    const run = () => {
      if (cancelled) return;
      api<ProductDetail>(`/products/${slug}`)
        .then(async (product) => {
          if (cancelled) return;
          setP(product);
          rememberProductView(product);
          recordAbandonedProductView(product);
          await Promise.all([loadReviews(product.id), loadEligibility(product.id)]);
        })
        .catch((e) => {
          if (!cancelled) setErr(e.message);
        });
    };
    const cancelSchedule = primed ? scheduleAfterFirstPaint(run) : null;
    if (!primed) run();
    return () => {
      cancelled = true;
      cancelSchedule?.();
    };
    // initial is read once per slug; a new object for the same product must not reset the buy box.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, loadReviews, loadEligibility]);

  async function postToCart(): Promise<boolean> {
    if (!p || adding || isDemoCatalogProduct(p)) return false;
    setAdding(true);
    setErr('');
    try {
      await api('/cart/items', { method: 'POST', body: JSON.stringify({ productId: p.id, qty: 1 }) });
      try {
        window.dispatchEvent(new Event('sch-cart-updated'));
      } catch {
        /* ignore */
      }
      return true;
    } catch (e: any) {
      setErr(e.message || 'Não foi possível adicionar à sacola');
      return false;
    } finally {
      setAdding(false);
    }
  }

  async function add() {
    const ok = await postToCart();
    if (!ok) return;
    setAddedToBag(true);
    setShowBagToast(true);
    setMsg('Adicionado à sacola.');
  }

  async function buyNow() {
    const ok = await postToCart();
    if (!ok) return;
    setAddedToBag(true);
    router.push(pdpBuyNowHref());
  }

  async function submitReview(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!p) return;
    setSavingReview(true);
    setErr('');
    try {
      await api(`/products/${p.id}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ rating, body: body.trim() || undefined }),
      });
      setMsg(eligibility?.myReview ? 'Avaliação atualizada.' : 'Avaliação publicada. Obrigado!');
      const refreshed = await api<ProductDetail>(`/products/${p.slug}`);
      setP(refreshed);
      await Promise.all([loadReviews(p.id), loadEligibility(p.id)]);
    } catch (e: any) {
      setErr(e.message || 'Não foi possível salvar a avaliação');
    } finally {
      setSavingReview(false);
    }
  }

  const gallery = useMemo(() => (p ? buildProductGallery(p) : []), [p]);

  if (err && !p) return <div className="alert" style={{ marginTop: 24 }}>{err}</div>;
  if (!p) return <PdpSkeleton />;

  const demo = isDemoCatalogProduct(p);
  const stock = resolveProductStock(p);
  const urgency = pdpLowStockUrgency(stock);
  const stockLabel = demo ? 'Catálogo demonstrativo — sem venda' : pdpStockLine(stock);
  const trustChips = pdpCompactTrustChips(p.seller?.name, pdpPriceTrustLines());
  const benefitTrust = pdpBenefitTrustItems().filter((item) => item.id === 'frete');
  const avg = Number(p.ratingAvg ?? 0);
  const count = p.ratingCount ?? 0;
  const loggedIn = Boolean(currentUser());
  const price = Number(p.price);
  const pix = pixPrice(price);
  const highlight = pixHighlight(price);
  const sharePix = pdpSharePixLabel(price);
  const outOfStock = stock != null && stock <= 0;
  const buyBlocked = demo || outOfStock;
  const description = productDescriptionText(p.description);
  const descNeedsCollapse = pdpDescriptionNeedsCollapse(description);
  const offerPills = pdpOfferPills();

  return (
    <div className="pdp sf-pro-pdp">
      <div className="pdp-grid">
        <div className="pdp-gallery-col">
          <ProductGallery images={gallery} productName={p.name} />
          <div className="pdp-gallery-tools">
            <FavoriteToggle productId={p.id} product={p} variant="pdp" />
            <ProductWhatsAppShareButton
              productName={p.name}
              productSlug={p.slug}
              pixLabel={sharePix}
              variant="icon"
            />
            <ProductShareButton
              productName={p.name}
              productSlug={p.slug}
              pixLabel={sharePix}
              variant="icon"
            />
          </div>
        </div>

        <div className="pdp-buybox">
          <div className="pdp-identity">
            {p.badge ? <div className="badge">{p.badge}</div> : null}
            <div className="pdp-title-row">
              <h1 className="pdp-title">{p.name}</h1>
              <div className="pdp-rating">
                <span className="pdp-rating-score">
                  {count > 0 ? avg.toFixed(1).replace('.', ',') : '—'}
                </span>
                <Stars value={Math.round(avg)} size={14} />
                <span className="pdp-rating-meta muted">
                  {count > 0
                    ? `${count} avaliação${count === 1 ? '' : 'ões'}`
                    : 'Sem avaliações'}
                </span>
              </div>
              <ProductWhatsAppShareButton
                productName={p.name}
                productSlug={p.slug}
                pixLabel={sharePix}
                variant="icon"
              />
              <ProductShareButton productName={p.name} productSlug={p.slug} pixLabel={sharePix} />
            </div>
            {p.sku ? <p className="pdp-model muted">Modelo {p.sku}</p> : null}
            {p.seller?.name ? (
              <p className="pdp-seller muted">
                Vendido por <b style={{ color: 'var(--text)' }}>{p.seller.name}</b>
              </p>
            ) : null}
          </div>

          <div className="pdp-price-block">
            <ul className="pdp-offer-pills" aria-label="Condições da oferta">
              {offerPills.map((pill) => (
                <li key={pill.id} className={`pdp-offer-pill pdp-offer-pill--${pill.tone}`}>
                  {pill.label}
                </li>
              ))}
            </ul>
            <div className="pdp-price-row pdp-price-lead">
              <span className="price pdp-price">{brl(pix)}</span>
              <span className="pdp-pix-word">no PIX</span>
              {highlight.savings > 0 ? <span className="pdp-pix-kicker">{highlight.tag}</span> : null}
            </div>
            <p className="pdp-list-line">
              ou{' '}
              {p.compareAtPrice ? <span className="compare">{brl(p.compareAtPrice)}</span> : null}{' '}
              <span className="pdp-list-price">{brl(price)}</span>
              {' em '}
              {installmentLine(price)}
            </p>
            <PdpFreightCep
              subtotal={price}
              item={{
                qty: 1,
                weightKg: positiveMeasure(p.weightKg),
                widthCm: positiveMeasure(p.widthCm),
                heightCm: positiveMeasure(p.heightCm),
                lengthCm: positiveMeasure(p.lengthCm),
                insuranceValue: price,
              }}
            />
            <ul className="pdp-price-trust" aria-label="Vendedor, troca e garantia">
              {trustChips.map((chip) => (
                <li key={chip.id}>
                  {chip.href ? <Link href={chip.href}>{chip.label}</Link> : <span>{chip.label}</span>}
                </li>
              ))}
            </ul>
            <details className="pdp-install-table">
              <summary>Ver parcelas (1 a {MAX_INSTALLMENTS}x)</summary>
              <ul>
                {Array.from({ length: MAX_INSTALLMENTS }, (_, i) => i + 1).map((n) => (
                  <li key={n}>
                    {n}x de {brl(installmentValue(price, n))}
                    {installmentSuffix(n)}
                  </li>
                ))}
              </ul>
              <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>
                {installmentTableNote()}
              </p>
            </details>
          </div>

          {description ? (
            <div className={`pdp-desc${descNeedsCollapse && !descOpen ? ' is-collapsed' : ''}`}>
              <h2>Descrição</h2>
              <p className="pdp-desc-body">{description}</p>
              {descNeedsCollapse ? (
                <button
                  type="button"
                  className="pdp-desc-toggle"
                  aria-expanded={descOpen}
                  onClick={() => setDescOpen((open) => !open)}
                >
                  {descOpen ? 'Ver menos' : 'Ver mais'}
                </button>
              ) : null}
            </div>
          ) : null}

          <p className={`pdp-stock${urgency ? ' pdp-stock-low' : stock != null && stock <= 0 ? ' pdp-stock-out' : ''}`}>
            {urgency ? <span className="pcard-stock pcard-stock-low">{urgency}</span> : null}{' '}
            {stockLabel}
          </p>

          {demo ? (
            <p className="pdp-demo-note" role="status">
              {DEMO_SEAL_LABEL}. {DEMO_PURCHASE_BLOCK_MESSAGE}
            </p>
          ) : null}
          {msg && !addedToBag ? <p className="ok">{msg}</p> : null}
          {err ? <p className="alert">{err}</p> : null}

          {addedToBag ? (
            <div className="pdp-added-banner ok" role="status">
              <div>
                <strong>Adicionado à sacola</strong>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: 13, color: 'inherit', opacity: 0.9 }}>
                  Pronto! Revise os itens ou finalize a compra.
                </p>
              </div>
              <Link className="btn" href="/carrinho" style={{ whiteSpace: 'nowrap' }}>
                Ver sacola
              </Link>
            </div>
          ) : null}

          <div className="actions pdp-actions">
            {addedToBag && !buyBlocked ? (
              <Link className="btn pdp-cta-primary" href="/carrinho">
                Ir para a sacola
              </Link>
            ) : (
              <button className="btn pdp-cta-primary" onClick={add} disabled={buyBlocked || adding}>
                {demo ? 'Não disponível' : outOfStock ? 'Indisponível' : adding ? 'Adicionando...' : 'Adicionar à sacola'}
              </button>
            )}
            <button
              className="btn pdp-cta-buy-now"
              type="button"
              onClick={buyNow}
              disabled={buyBlocked || adding}
            >
              {buyNowLabel({ outOfStock, adding, demo })}
            </button>
            {addedToBag && !buyBlocked ? (
              <>
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() => {
                    setShowBagToast(false);
                    setMsg('');
                  }}
                >
                  Continuar comprando
                </button>
                <button className="btn ghost" type="button" onClick={add} disabled={adding}>
                  {adding ? 'Adicionando...' : 'Adicionar mais'}
                </button>
              </>
            ) : null}
            <CompareToggle product={p} variant="pdp" />
            <FavoriteToggle productId={p.id} product={p} variant="pdp" />
            <a
              className="btn wa pdp-cta-wa"
              href={waLink(`Olá, quero o produto ${p.name}`)}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp
            </a>
          </div>

          <ul className="pdp-trust" aria-label="Benefícios">
            {benefitTrust.map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong>
                <span className="muted">
                  {item.href ? <Link href={item.href}>{item.body}</Link> : item.body}
                </span>
              </li>
            ))}
            <li>
              <strong>WhatsApp</strong>
              <span className="muted">
                <a href={waLink(`Olá, dúvida sobre ${p.name}`)} target="_blank" rel="noreferrer">
                  Falar com a loja
                </a>
              </span>
            </li>
          </ul>
        </div>
      </div>

      <section className="card pdp-reviews" style={{ marginTop: 28 }}>
        <div className="body">
          <h2 style={{ marginTop: 0, fontSize: 20 }}>Avaliações</h2>
          <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
            Clientes que compraram este produto podem deixar nota de 1 a 5 e um comentário opcional.
          </p>

          {!loggedIn ? (
            <p className="muted">
              <Link href="/entrar">Entre na sua conta</Link> para avaliar (após a compra).
            </p>
          ) : eligibility?.canReview ? (
            <form onSubmit={submitReview} style={{ display: 'grid', gap: 10, marginBottom: 20, maxWidth: 520 }}>
              <div>
                <div style={{ marginBottom: 6, fontWeight: 600 }}>
                  {eligibility.myReview ? 'Sua avaliação (editar)' : 'Sua avaliação'}
                </div>
                <Stars value={rating} onChange={setRating} size={28} />
              </div>
              <label>
                Comentário (opcional)
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Conte como foi o produto..."
                  style={{ width: '100%', marginTop: 4 }}
                />
              </label>
              <button className="btn" type="submit" disabled={savingReview} style={{ width: 'fit-content' }}>
                {savingReview
                  ? 'Salvando...'
                  : eligibility.myReview
                    ? 'Atualizar avaliação'
                    : 'Publicar avaliação'}
              </button>
            </form>
          ) : (
            <p className="muted" style={{ marginBottom: 16 }}>
              Você poderá avaliar depois de comprar e pagar este produto.
            </p>
          )}

          <div style={{ display: 'grid', gap: 12 }}>
            {reviews.map((r) => (
              <div
                key={r.id}
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: 'var(--bg)',
                  border: '1px solid var(--line)',
                }}
              >
                <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Stars value={r.rating} size={16} />
                    <b>{r.user?.name || 'Cliente'}</b>
                  </div>
                  <span className="muted" style={{ fontSize: 13 }}>
                    {formatReviewDate(r.updatedAt || r.createdAt)}
                  </span>
                </div>
                {r.body ? <p style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>{r.body}</p> : null}
              </div>
            ))}
            {!reviews.length ? (
              <div className="pdp-reviews-empty">
                <p style={{ margin: 0, fontWeight: 700 }}>Ainda não há avaliações</p>
                <p className="muted" style={{ margin: '6px 0 0', fontSize: 14 }}>
                  Seja o primeiro a contar como foi a experiência com este produto após a compra.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {relatedSlot ?? (
        <PdpRelatedProducts
          productId={p.id}
          productSlug={p.slug}
          categorySlug={p.category?.slug}
          categoryName={p.category?.name}
          initial={related}
          initialKind={relatedKind}
        />
      )}

      <RecentlyViewedStrip excludeId={p.id} excludeSlug={p.slug} />

      {showBagToast ? (
        <div className="pdp-cart-toast" role="status" aria-live="polite">
          <span>Adicionado à sacola</span>
          <Link className="btn" href="/carrinho" onClick={() => setShowBagToast(false)}>
            Ver sacola
          </Link>
          <button
            type="button"
            className="pdp-cart-toast-x"
            aria-label="Fechar"
            onClick={() => setShowBagToast(false)}
          >
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}
