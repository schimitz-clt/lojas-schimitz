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
};

export function ProductCard({ p }: { p: Product }) {
  const img = p.images?.[0]?.url;
  const count = p.ratingCount ?? 0;
  const avg = Number(p.ratingAvg ?? 0);
  return (
    <Link href={`/produto/${p.slug}`} className="card">
      <div style={{ aspectRatio: '1', background: '#111', display: 'grid', placeItems: 'center' }}>
        {img ? <img src={img} alt={p.name} /> : <span className="muted">Sem foto</span>}
      </div>
      <div className="body">
        {p.badge ? <div className="badge">{p.badge}</div> : null}
        <div>{p.name}</div>
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
