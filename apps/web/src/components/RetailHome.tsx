'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, brl } from '@/lib/api';
import { HomeBanners } from '@/components/HomeBanners';
import type { Product as ProductType } from '@/components/ProductCard';
import { discountPercent } from '@/lib/storefront-pro';
import { installmentLine, pixPrice } from '@/lib/pricing';
import { resolveProductImageUrl } from '@/lib/product-media';
import { productLandingPath } from '@/lib/marketing';
import {
  bestsellerIdsFromShelves,
  configuredPromoLines,
  isRealOffer,
  offerCountdown,
  parsePromoEnd,
  resolveRetailTrust,
  visibleCatalogBadge,
  type OfferCountdown,
  type RetailTrustItem,
} from '@/lib/retail-home';

type PublicReview = {
  id: string;
  rating: number;
  body: string;
  createdAt: string;
  authorName: string;
  productName: string;
  productSlug: string;
};

type StorePromo = {
  cnpj?: string | null;
  promoEndsAt?: string | null;
  promoLines?: string[] | null;
  trustItems?: { title: string; body: string }[] | null;
};

function Stars({ value }: { value: number }) {
  const n = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span className="retail-stars" aria-label={`${n} de 5`}>
      {'★★★★★'.slice(0, n)}
      <span aria-hidden>{'★★★★★'.slice(n)}</span>
    </span>
  );
}

function Countdown({ parts }: { parts: OfferCountdown }) {
  const cells = [
    ['dias', parts.days],
    ['horas', parts.hours],
    ['min', parts.minutes],
    ['seg', parts.seconds],
  ] as const;
  return (
    <div className="retail-count" aria-label="Tempo restante da oferta">
      {cells.map(([label, value]) => (
        <span key={label}>
          <strong>{String(value).padStart(2, '0')}</strong>
          {label}
        </span>
      ))}
    </div>
  );
}

function RetailCard({
  product,
  bestseller,
  priority,
}: {
  product: ProductType;
  bestseller: boolean;
  priority?: boolean;
}) {
  const href = productLandingPath(product.slug);
  const price = Number(product.price);
  const pix = pixPrice(price);
  const off = discountPercent(price, product.compareAtPrice);
  const badge = visibleCatalogBadge(product.badge, bestseller);
  const img = resolveProductImageUrl(product);
  return (
    <article className="retail-card">
      <Link href={href} className="retail-card-media">
        {off ? <span className="retail-off">-{off}%</span> : null}
        {bestseller ? <span className="retail-best">Mais vendido</span> : null}
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={product.name} width={640} height={640} loading={priority ? 'eager' : 'lazy'} />
        ) : (
          <span className="retail-card-ph">Lojas Schimitz</span>
        )}
      </Link>
      <div className="retail-card-body">
        {badge && badge !== 'Mais vendido' ? <p className="retail-kicker">{badge}</p> : null}
        <h3>
          <Link href={href}>{product.name}</Link>
        </h3>
        <p className="retail-price">
          <strong>{brl(pix)}</strong>
          <span>no PIX</span>
        </p>
        <p className="retail-install">
          {product.compareAtPrice ? <s>{brl(product.compareAtPrice)}</s> : null} {installmentLine(price)}
        </p>
        <Link className="btn retail-buy" href={href}>
          Comprar
        </Link>
      </div>
    </article>
  );
}

export function RetailHome({ products }: { products: ProductType[] }) {
  const [settings, setSettings] = useState<StorePromo | null>(null);
  const [bestsellerIds, setBestsellerIds] = useState<Set<string>>(new Set());
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    api<StorePromo>('/store/settings')
      .then((data) => {
        if (!cancelled) setSettings(data);
      })
      .catch(() => {
        if (!cancelled) setSettings(null);
      });
    api<unknown>('/store/shelves')
      .then((data) => {
        if (!cancelled) setBestsellerIds(bestsellerIdsFromShelves(data));
      })
      .catch(() => {
        if (!cancelled) setBestsellerIds(new Set());
      });
    api<PublicReview[]>('/store/reviews')
      .then((data) => {
        if (!cancelled) setReviews(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setReviews([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const endsAt = parsePromoEnd(settings?.promoEndsAt);
  const countdown = offerCountdown(endsAt, now);
  useEffect(() => {
    if (!endsAt || endsAt.getTime() <= Date.now()) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [endsAt]);

  const offers = useMemo(
    () => products.filter((product) => isRealOffer(product.price, product.compareAtPrice)),
    [products],
  );
  const trust = useMemo(
    () => resolveRetailTrust({ trustItems: settings?.trustItems, cnpj: settings?.cnpj }),
    [settings],
  );
  const promoNote = configuredPromoLines(settings?.promoLines);

  return (
    <div className="home retail-home">
      <HomeBanners products={products} />
      {promoNote ? <p className="sr-only">Faixa promocional configurada na loja.</p> : null}

      {offers.length ? (
        <section className="retail-offers" aria-labelledby="retail-offers-title">
          <div className="retail-offers-head">
            <div>
              <p className="retail-kicker">Hoje na loja</p>
              <h2 id="retail-offers-title">Ofertas do dia</h2>
            </div>
            {countdown ? <Countdown parts={countdown} /> : null}
          </div>
          <div className="retail-grid">
            {offers.map((product, index) => (
              <RetailCard
                key={product.id}
                product={product}
                bestseller={bestsellerIds.has(product.id)}
                priority={index < 2}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="retail-catalog" aria-labelledby="retail-catalog-title">
        <div className="section-head">
          <h2 id="retail-catalog-title">Na loja</h2>
          <span>{products.length === 1 ? '1 produto' : `${products.length} produtos`}</span>
        </div>
        <div className="retail-grid">
          {products.map((product, index) => (
            <RetailCard
              key={product.id}
              product={product}
              bestseller={bestsellerIds.has(product.id)}
              priority={index < 2}
            />
          ))}
        </div>
      </section>

      <ul className="retail-trust" aria-label="Confiança da loja">
        {trust.map((item: RetailTrustItem) => (
          <li key={item.id}>
            <strong>{item.title}</strong>
            <span>{item.body}</span>
          </li>
        ))}
      </ul>

      {reviews.length ? (
        <section className="retail-reviews" aria-labelledby="retail-reviews-title">
          <h2 id="retail-reviews-title">Avaliações</h2>
          <ul>
            {reviews.map((review) => (
              <li key={review.id}>
                <Stars value={review.rating} />
                {review.body ? <p>“{review.body}”</p> : null}
                <span>
                  {review.authorName} ·{' '}
                  <Link href={productLandingPath(review.productSlug)}>{review.productName}</Link>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
