import Link from 'next/link';
import { brl } from '@/lib/api';
import { installmentLine, pixPrice, stockBadge } from '@/lib/pricing';

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
  inventory?: { qtyOnHand: number; qtyReserved: number } | null;
  seller?: { id: string; name: string; slug: string } | null;
};

function resolveImageUrl(p: Product): string {
  const nested = p.images?.[0]?.url?.trim() || '';
  if (nested) return nested;
  const flat = (p.image || p.imageUrl || '').trim();
  return flat;
}

function resolveStock(p: Product): number | null {
  if (typeof p.stock === 'number') return p.stock;
  if (p.stock === null) return null;
  if (p.inventory) return p.inventory.qtyOnHand - p.inventory.qtyReserved;
  return null;
}

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
    return <span className="muted">Sem foto</span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={400}
      height={400}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      onError={(e) => {
        const el = e.currentTarget;
        el.style.display = 'none';
        const fallback = el.parentElement?.querySelector('[data-img-fallback]');
        if (fallback instanceof HTMLElement) fallback.style.display = 'grid';
      }}
    />
  );
}

export function ProductCard({ p, priority = false }: { p: Product; priority?: boolean }) {
  const img = resolveImageUrl(p);
  const count = p.ratingCount ?? 0;
  const avg = Number(p.ratingAvg ?? 0);
  const stock = resolveStock(p);
  const sb = stockBadge(stock);
  const price = Number(p.price);
  const pix = pixPrice(price);

  return (
    <article className="pcard">
      <Link href={`/produto/${p.slug}`} className="pcard-link">
        <div className="pcard-media">
          {img ? <ProductImage src={img} alt={p.name} priority={priority} /> : null}
          <span
            data-img-fallback
            className="muted pcard-fallback"
            style={{ display: img ? 'none' : 'grid' }}
          >
            Sem foto
          </span>
          {p.badge ? <span className="pcard-badge">{p.badge}</span> : null}
          {sb ? (
            <span className={`pcard-stock pcard-stock-${sb.tone}`}>{sb.label}</span>
          ) : null}
        </div>
        <div className="pcard-body">
          <h3 className="pcard-title">{p.name}</h3>
          {p.seller?.name ? (
            <p className="pcard-seller muted">Vendido por {p.seller.name}</p>
          ) : null}
          {count > 0 ? (
            <p className="pcard-rating muted">
              ★ {avg.toFixed(1).replace('.', ',')} · {count} avaliação{count === 1 ? '' : 'ões'}
            </p>
          ) : null}
          <div className="pcard-price-row">
            <span className="price">{brl(price)}</span>
            {p.compareAtPrice ? <span className="compare">{brl(p.compareAtPrice)}</span> : null}
          </div>
          <p className="pcard-pix">
            <strong>{brl(pix)}</strong> no PIX <span className="muted">(5% off)</span>
          </p>
          <p className="pcard-install muted">{installmentLine(price)}</p>
        </div>
      </Link>
      <div className="pcard-cta">
        <Link
          className={`btn pcard-btn${sb?.tone === 'out' ? ' ghost' : ''}`}
          href={`/produto/${p.slug}`}
          aria-disabled={sb?.tone === 'out'}
        >
          {sb?.tone === out' ? 'Ver detalhes' : 'Adicionar ao carrinho'}
        </Link>
      </div>
    </article>
  );
}
