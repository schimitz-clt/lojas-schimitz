'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, brl, currentUser, getGuestToken, waLink } from '@/lib/api';
import {
  installmentLine,
  installmentValue,
  MAX_INSTALLMENTS,
  pixPrice,
  stockBadge,
} from '@/lib/pricing';

type Detail = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: string | number;
  compareAtPrice?: string | number | null;
  badge?: string | null;
  ratingAvg?: string | number;
  ratingCount?: number;
  images?: { url: string }[];
  stock?: number | null;
  image?: string | null;
  imageUrl?: string | null;
  inventory?: { qtyOnHand: number; qtyReserved: number } | null;
  seller?: { id: string; name: string; slug: string } | null;
};

type Review = {
  id: string;
  rating: number;
  body: string;
  createdAt: string;
  updatedAt?: string;
  user: { id: string; name: string };
};

type Eligibility = {
  hasPurchased: boolean;
  canReview: boolean;
  myReview: Review | null;
};

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

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const [p, setP] = useState<Detail | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [savingReview, setSavingReview] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [galleryIdx, setGalleryIdx] = useState(0);

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
    getGuestToken();
    setGalleryIdx(0);
    api<Detail>(`/products/${slug}`)
      .then(async (product) => {
        setP(product);
        await Promise.all([loadReviews(product.id), loadEligibility(product.id)]);
      })
      .catch((e) => setErr(e.message));
  }, [slug, loadReviews, loadEligibility]);

  async function add() {
    if (!p) return;
    try {
      await api('/cart/items', { method: 'POST', body: JSON.stringify({ productId: p.id, qty: 1 }) });
      setMsg('Adicionado à sacola.');
      setErr('');
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function fav() {
    if (!p) return;
    try {
      await api('/favorites', { method: 'POST', body: JSON.stringify({ productId: p.id }) });
      setMsg('Salvo nos favoritos.');
      setErr('');
    } catch (e: any) {
      setErr(e.message);
    }
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
      const refreshed = await api<Detail>(`/products/${p.slug}`);
      setP(refreshed);
      await Promise.all([loadReviews(p.id), loadEligibility(p.id)]);
    } catch (e: any) {
      setErr(e.message || 'Não foi possível salvar a avaliação');
    } finally {
      setSavingReview(false);
    }
  }

  const gallery = useMemo(() => {
    if (!p) return [] as string[];
    const urls = (p.images || [])
      .map((i) => (i.url || '').trim())
      .filter(Boolean);
    if (urls.length) return urls;
    const flat = (p.image || p.imageUrl || '').trim();
    return flat ? [flat] : [];
  }, [p]);

  if (err && !p) return <div className="alert" style={{ marginTop: 24 }}>{err}</div>;
  if (!p) return <p className="muted">Carregando...</p>;

  const stockFromInv =
    p.inventory != null ? p.inventory.qtyOnHand - p.inventory.qtyReserved : null;
  const stock =
    typeof p.stock === 'number' ? p.stock : p.stock === null ? null : stockFromInv;
  const sb = stockBadge(stock);
  const stockLabel =
    stock == null
      ? 'Estoque sob consulta'
      : stock <= 0
        ? 'Esgotado'
        : stock <= 5
          ? `Últimas unidades · ${stock} restantes`
          : `Em estoque · ${stock} unidades`;
  const primaryImg = gallery[Math.min(galleryIdx, Math.max(0, gallery.length - 1))] || '';
  const avg = Number(p.ratingAvg ?? 0);
  const count = p.ratingCount ?? 0;
  const loggedIn = Boolean(currentUser());
  const price = Number(p.price);
  const pix = pixPrice(price);
  const outOfStock = stock != null && stock <= 0;

  return (
    <div className="pdp" style={{ padding: '24px 0' }}>
      <div className="pdp-grid">
        <div className="pdp-gallery">
          <div className="pdp-main-img card">
            {primaryImg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={primaryImg}
                alt={p.name}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fb = e.currentTarget.parentElement?.querySelector('[data-img-fallback]');
                  if (fb instanceof HTMLElement) fb.style.display = 'grid';
                }}
              />
            ) : null}
            <span
              data-img-fallback
              className="muted"
              style={{ display: primaryImg ? 'none' : 'grid', placeItems: 'center', padding: 24 }}
            >
              Sem foto
            </span>
          </div>
          {gallery.length > 1 ? (
            <div className="pdp-thumbs" role="list">
              {gallery.map((url, i) => (
                <button
                  key={`${url}-${i}`}
                  type="button"
                  className={`pdp-thumb${i === galleryIdx ? ' active' : ''}`}
                  onClick={() => setGalleryIdx(i)}
                  aria-label={`Foto ${i + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="pdp-buybox">
          {p.badge ? <div className="badge">{p.badge}</div> : null}
          <h1 className="pdp-title">{p.name}</h1>
          {p.seller?.name ? (
            <p className="pdp-seller muted">
              Vendido por <b style={{ color: 'var(--text)' }}>{p.seller.name}</b>
            </p>
          ) : null}
          <div className="pdp-rating">
            <Stars value={Math.round(avg)} />
            <span className="muted" style={{ fontSize: 14 }}>
              {count > 0
                ? `${avg.toFixed(1).replace('.', ',')} · ${count} avaliação${count === 1 ? '' : 'ões'}`
                : 'Sem avaliações ainda'}
            </span>
          </div>

          <div className="pdp-price-block">
            <div className="pdp-price-row">
              <span className="price pdp-price">{brl(price)}</span>
              {p.compareAtPrice ? <span className="compare">{brl(p.compareAtPrice)}</span> : null}
            </div>
            <p className="pdp-pix">
              <strong>{brl(pix)}</strong> no PIX <span className="muted">· 5% de desconto</span>
            </p>
            <p className="pdp-install muted">{installmentLine(price)}</p>
            <details className="pdp-install-table">
              <summary>Ver parcelas (1 a {MAX_INSTALLMENTS}x)</summary>
              <ul>
                {Array.from({ length: MAX_INSTALLMENTS }, (_, i) => i + 1).map((n) => (
                  <li key={n}>
                    {n}x de {brl(installmentValue(price, n))}
                    {n === 1 ? ' à vista' : ' sem juros'}
                  </li>
                ))}
              </ul>
            </details>
          </div>

          <p className={`pdp-stock${sb ? ` pdp-stock-${sb.tone}` : ''}`}>
            {sb ? <span className={`pcard-stock pcard-stock-${sb.tone}`}>{sb.label}</span> : null}{' '}
            {stockLabel}
          </p>

          {msg ? <p className="ok">{msg}</p> : null}
          {err ? <p className="alert">{err}</p> : null}

          <div className="actions pdp-actions">
            <button className="btn" onClick={add} disabled={outOfStock}>
              {outOfStock ? 'Indisponível' : 'Adicionar à sacola'}
            </button>
            <button className="btn ghost" onClick={fav}>
              Favoritar
            </button>
            <a
              className="btn wa"
              href={waLink(`Olá, quero o produto ${p.name}`)}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp
            </a>
          </div>

          <ul className="pdp-trust" aria-label="Benefícios">
            <li>
              <strong>Frete POA</strong>
              <span className="muted">Grátis em Porto Alegre</span>
            </li>
            <li>
              <strong>Troca 7 dias</strong>
              <span className="muted">Direito a arrependimento</span>
            </li>
            <li>
              <strong>WhatsApp</strong>
              <span className="muted">
                <a href={waLink(`Olá, dúvida sobre ${p.name}`)} target="_blank" rel="noreferrer">
                  Falar com a loja
                </a>
              </span>
            </li>
          </ul>

          {p.description ? (
            <div className="pdp-desc">
              <h2>Descrição</h2>
              <p className="muted" style={{ whiteSpace: 'pre-wrap' }}>
                {p.description}
              </p>
            </div>
          ) : null}
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
    </div>
  );
}
