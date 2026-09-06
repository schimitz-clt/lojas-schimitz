'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, brl, currentUser, getGuestToken, waLink } from '@/lib/api';

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
  /** Flat fields from public product serializer (same source as cart). */
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

  if (err && !p) return <div className="alert" style={{ marginTop: 24 }}>{err}</div>;
  if (!p) return <p className="muted">Carregando...</p>;
  const stockFromInv =
    p.inventory != null
      ? p.inventory.qtyOnHand - p.inventory.qtyReserved
      : null;
  const stock =
    typeof p.stock === 'number'
      ? p.stock
      : p.stock === null
        ? null
        : stockFromInv;
  const stockLabel =
    stock == null
      ? 'Sob consulta'
      : stock <= 0
        ? 'Indisponível no momento'
        : `Estoque: ${stock}`;
  const primaryImg =
    (p.images?.[0]?.url?.trim() || p.image?.trim() || p.imageUrl?.trim() || '');
  const avg = Number(p.ratingAvg ?? 0);
  const count = p.ratingCount ?? 0;
  const loggedIn = Boolean(currentUser());

  return (
    <div style={{ padding: '24px 0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) 1fr', gap: 24 }}>
        <div className="card" style={{ aspectRatio: '1', background: '#111', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
          {primaryImg ? (
            <img
              src={primaryImg}
              alt={p.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const fb = e.currentTarget.parentElement?.querySelector('[data-img-fallback]');
                if (fb instanceof HTMLElement) fb.style.display = 'grid';
              }}
            />
          ) : null}
          <span data-img-fallback className="muted" style={{ display: primaryImg ? 'none' : 'grid', placeItems: 'center', padding: 24 }}>
            Sem foto
          </span>
        </div>
        <div>
          {p.badge ? <div className="badge">{p.badge}</div> : null}
          <h1>{p.name}</h1>
          {p.seller?.name ? (
            <p className="muted" style={{ marginTop: -8 }}>
              Vendido por <b style={{ color: 'var(--text)' }}>{p.seller.name}</b>
            </p>
          ) : null}
          <p className="muted">{p.description}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Stars value={Math.round(avg)} />
            <span className="muted" style={{ fontSize: 14 }}>
              {count > 0
                ? `${avg.toFixed(1).replace('.', ',')} · ${count} avaliação${count === 1 ? '' : 'ões'}`
                : 'Sem avaliações ainda'}
            </span>
          </div>
          <p>
            <span className="price">{brl(p.price)}</span>
            {p.compareAtPrice ? <span className="compare">{brl(p.compareAtPrice)}</span> : null}
          </p>
          <p className="muted">{stockLabel} · 12x sem juros · 5% off no PIX</p>
          {msg ? <p className="ok">{msg}</p> : null}
          {err ? <p className="alert">{err}</p> : null}
          <div className="actions">
            <button className="btn" onClick={add}>Adicionar à sacola</button>
            <button className="btn ghost" onClick={fav}>Favoritar</button>
            <a className="btn wa" href={waLink(`Olá, quero o produto ${p.name}`)} target="_blank" rel="noreferrer">WhatsApp</a>
          </div>
        </div>
      </div>

      <section className="card" style={{ marginTop: 28 }}>
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
            {!reviews.length ? <p className="muted">Nenhuma avaliação publicada ainda.</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
