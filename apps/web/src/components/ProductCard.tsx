'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api, brl } from '@/lib/api';
import { installmentLine, pixPrice, stockBadge } from '@/lib/pricing';
import { discountPercent } from '@/lib/storefront-pro';
import { productCardCues, productCardKicker } from '@/lib/product-card-cues';
import { resolveProductImageUrl, resolveProductStock } from '@/lib/product-media';
import { CompareToggle } from '@/components/compare/CompareToggle';
import { FavoriteToggle } from '@/components/favorites/FavoriteToggle';

export type Product = {
  id: string;
  name: string;
  slug: string;
  price: number | string;
  compareAtPrice?: number | string | null;
  badge?: string | null;
  ratingAvg?: number | string;
  ratingCount?: number;
  images?: { url: string }[];
  /** Flat primary image (same as cart / public API). */
  image?: string | null;
  imageUrl?: string | null;
  stock?: number | null;
  inventory?: { qtyOnHand?: number; qtyReserved?: number; available?: number | null } | null;
  seller?: { id: string; name: string; slug: string } | null;
  category?: { slug: string; name: string } | null;
  createdAt?: string | Date | null;
};

function ProductImage({
  src,
  alt,
  priority,
}: {
  src?: string;
  alt: string;
  priority?: boolean;
}) {
  if (!src) {
    return (
      <div className="pcard-ph" aria-hidden>
        <span className="pcard-ph-mark">
          LOJAS <em>SCHIMITZ</em>
        </span>
        <span className="pcard-ph-hint">Imagem em breve</span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={480}
      height={480}
      sizes="(max-width: 640px) 48vw, (max-width: 1024px) 33vw, 240px"
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      onError={(e) => {
        const el = e.currentTarget;
        el.style.display = 'none';
        const fallback = el.parentElement?.querySelector('[data-img-fallback]');
        if (fallback instanceof HTMLElement) fallback.style.display = 'flex';
      }}
    />
  );
}

export function ProductCard({ p, priority = false }: { p: Product; priority?: boolean }) {
  const img = resolveProductImageUrl(p);
  const count = p.ratingCount ?? 0;
  const avg = Number(p.ratingAvg ?? 0);
  const stock = resolveProductStock(p);
  const sb = stockBadge(stock);
  const price = Number(p.price);
  const pix = pixPrice(price);
  const off = discountPercent(price, p.compareAtPrice);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const out = sb?.tone === 'out';
  const kicker = productCardKicker(p.category?.name, p.seller?.name);
  const cues = productCardCues();

  async function addToCart(e: { preventDefault(): void; stopPropagation(): void }) {
    e.preventDefault();
    e.stopPropagation();
    if (out || adding) return;
    setAdding(true);
    try {
      await api('/cart/items', {
        method: 'POST',
        body: JSON.stringify({ productId: p.id, qty: 1 }),
      });
      setAdded(true);
      try {
        window.dispatchEvent(new Event('sch-cart-updated'));
      } catch {
        /* ignore */
      }
      window.setTimeout(() => setAdded(false), 1800);
    } catch {
      /* fallback: go to PDP */
      window.location.href = `/produto/${p.slug}`;
    } finally {
      setAdding(false);
    }
  }

  return (
    <article className="pcard pcard-pro">
      <FavoriteToggle productId={p.id} product={p} variant="card" />
      <CompareToggle product={p} variant="card" />
      <Link href={`/produto/${p.slug}`} className="pcard-link">
        <div className="pcard-media">
          {img ? <ProductImage src={img} alt={p.name} priority={priority} /> : null}
          <div
            data-img-fallback
            className="pcard-ph pcard-fallback"
            style={{ display: img ? 'none' : 'flex' }}
            aria-hidden={img ? true : undefined}
          >
            <span className="pcard-ph-mark">
              LOJAS <em>SCHIMITZ</em>
            </span>
            <span className="pcard-ph-hint">Imagem em breve</span>
          </div>
          <div className="pcard-tags">
            {off ? <span className="pcard-off">-{off}%</span> : null}
            {p.badge ? <span className="pcard-badge">{p.badge}</span> : null}
          </div>
          {sb ? <span className={`pcard-stock pcard-stock-${sb.tone}`}>{sb.label}</span> : null}
        </div>
        <div className="pcard-body">
          {kicker ? <p className="pcard-kicker">{kicker}</p> : null}
          <h3 className="pcard-title">{p.name}</h3>
          {p.seller?.name ? (
            <p className="pcard-seller muted">Vendido por {p.seller.name}</p>
          ) : null}
          {count > 0 ? (
            <p className="pcard-rating">
              <span className="pcard-stars" aria-hidden>
                ★
              </span>{' '}
              {avg.toFixed(1).replace('.', ',')}
              <span className="muted"> · {count}</span>
            </p>
          ) : null}
          <div className="pcard-price-stack">
            {p.compareAtPrice ? (
              <span className="pcard-compare">{brl(p.compareAtPrice)}</span>
            ) : null}
            <span className="pcard-price">{brl(price)}</span>
            <p className="pcard-pix">
              <strong>{brl(pix)}</strong> no PIX
              <span className="pcard-pix-tag">5% OFF</span>
            </p>
            <p className="pcard-install">{installmentLine(price)}</p>
          </div>
          <ul className="pcard-cues" aria-label="Condições">
            {cues.map((cue) => (
              <li key={cue.id} className={`pcard-cue pcard-cue-${cue.tone}`}>
                {cue.label}
              </li>
            ))}
          </ul>
        </div>
      </Link>
      <div className="pcard-cta">
        {out ? (
          <Link className="btn pcard-btn ghost" href={`/produto/${p.slug}`}>
            Ver detalhes
          </Link>
        ) : (
          <button
            type="button"
            className={`btn pcard-btn${added ? ' pcard-btn-ok' : ''}`}
            onClick={addToCart}
            disabled={adding}
          >
            {adding ? 'Adicionando…' : added ? '✓ Na sacola' : 'Adicionar ao carrinho'}
          </button>
        )}
      </div>
    </article>
  );
}
