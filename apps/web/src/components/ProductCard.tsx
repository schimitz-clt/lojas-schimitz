import Link from 'next/link';
import { brl } from '@/lib/api';

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
  seller?: { id: string; name: string; slug: string } | null;
};

function resolveImageUrl(p: Product): string {
  const nested = p.images?.[0]?.url?.trim() || '';
  if (nested) return nested;
  const flat = (p.image || p.imageUrl || '').trim();
  return flat;
}

function ProductImage({ src, alt }: { src?: string; alt: string }) {
  if (!src) {
    return <span className="muted">Sem foto</span>;
  }
  return (
    <img
      src={src}
      alt={alt}
      onError={(e) => {
        const el = e.currentTarget;
        el.style.display = 'none';
        const fallback = el.parentElement?.querySelector('[data-img-fallback]');
        if (fallback instanceof HTMLElement) fallback.style.display = 'grid';
      }}
    />
  );
}

export function ProductCard({ p }: { p: Product }) {
  const img = resolveImageUrl(p);
  const count = p.ratingCount ?? 0;
  const avg = Number(p.ratingAvg ?? 0);
  return (
    <Link href={`/produto/${p.slug}`} className="card">
      <div style={{ aspectRatio: '1', background: '#111', display: 'grid', placeItems: 'center', position: 'relative' }}>
        {img ? <ProductImage src={img} alt={p.name} /> : null}
        <span
          data-img-fallback
          className="muted"
          style={{ display: img ? 'none' : 'grid', placeItems: 'center', position: img ? 'absolute' : undefined, inset: 0 }}
        >
          Sem foto
        </span>
      </div>
      <div className="body">
        {p.badge ? <div className="badge">{p.badge}</div> : null}
        <div>{p.name}</div>
        {p.seller?.name ? (
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            Vendido por {p.seller.name}
          </div>
        ) : null}
        <div>
          <span className="price">{brl(p.price)}</span>
          {p.compareAtPrice ? <span className="compare">{brl(p.compareAtPrice)}</span> : null}
        </div>
        {count > 0 ? (
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            ★ {avg.toFixed(1).replace('.', ',')} · {count} avaliação{count === 1 ? '' : 'ões'}
          </div>
        ) : (
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>12x sem juros · 5% off no PIX</div>
        )}
      </div>
    </Link>
  );
}
