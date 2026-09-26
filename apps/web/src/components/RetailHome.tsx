'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { api, brl } from '@/lib/api';
import { HomeBanners } from '@/components/HomeBanners';
import type { Product as ProductType } from '@/components/ProductCard';
import { discountPercent } from '@/lib/storefront-pro';
import { installmentLine, pixPrice } from '@/lib/pricing';
import { resolveProductImageUrl } from '@/lib/product-media';
import { productLandingPath } from '@/lib/marketing';
import { displayHeadline, lineupLabel, pixOffLabel } from '@/lib/identidade';
import { PriceCount } from '@/components/identidade/Motion';
import { SchimitzMonogram } from '@/components/brand/SchimitzMark';
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

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const inView = () => {
      const rect = el.getBoundingClientRect();
      return rect.top < window.innerHeight * 0.92 && rect.bottom > 0;
    };
    el.classList.add('retail-reveal');
    if (inView()) {
      el.classList.add('is-in');
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          el.classList.add('is-in');
          observer.disconnect();
        }
      },
      { threshold: 0.18 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

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

function ProductPhoto({
  product,
  priority,
  className,
}: {
  product: ProductType;
  priority?: boolean;
  className?: string;
}) {
  const img = resolveProductImageUrl(product);
  if (!img) {
    return (
      <span className={`retail-mono ${className || ''}`} aria-hidden>
        {product.name.trim().slice(0, 1) || 'L'}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src={img}
      alt=""
      width={800}
      height={800}
      sizes={priority ? '(max-width: 720px) 72vw, 420px' : '(max-width: 720px) 42vw, 240px'}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'low'}
      decoding="async"
    />
  );
}

function RetailTile({
  product,
  bestseller,
  lead,
}: {
  product: ProductType;
  bestseller: boolean;
  lead?: boolean;
}) {
  const href = productLandingPath(product.slug);
  const price = Number(product.price);
  const pix = pixPrice(price);
  const off = discountPercent(price, product.compareAtPrice);
  const badge = visibleCatalogBadge(product.badge, bestseller);
  return (
    <article className={`retail-tile${lead ? ' retail-tile-lead' : ''}`}>
      <Link href={href} className="retail-tile-media">
        {off ? <span className="retail-off">-{off}%</span> : null}
        {bestseller ? <span className="retail-best">Mais vendido</span> : null}
        <ProductPhoto product={product} priority={lead} />
      </Link>
      <div className="retail-tile-body">
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

export function EditorialStage({ products }: { products: ProductType[] }) {
  const lineup = products.slice(0, 5);
  const [activeId, setActiveId] = useState(lineup[0]?.id || '');
  const lead = lineup.find((product) => product.id === activeId) || lineup[0];
  if (!lead) return null;
  const index = Math.max(0, lineup.findIndex((product) => product.id === lead.id));
  const href = productLandingPath(lead.slug);
  const price = Number(lead.price);
  const pix = pixPrice(price);
  const headline = displayHeadline(lead.name);
  const img = resolveProductImageUrl(lead);
  return (
    <section className="retail-stage id-abertura" aria-labelledby="retail-stage-title">
      <div className="id-sweep" aria-hidden="true" />
      <div className="id-halo" aria-hidden="true" />
      <div className="id-grain" aria-hidden="true" />
      <p className="id-kicker id-mono">
        <span>{lead.category?.name || 'Na loja'}</span>
        <span>
          <b>{lineupLabel(index + 1, lineup.length).slice(0, 2)}</b>
          {` / ${lineupLabel(index + 1, lineup.length).slice(5)}`}
        </span>
      </p>
      <h1 id="retail-stage-title" className="id-display">
        {headline.lead}
        {headline.accent ? (
          <>
            <br />
            <i>{headline.accent}</i>
          </>
        ) : null}
      </h1>
      <p className="id-cap id-mono">
        <b>{lead.name}</b>
      </p>
      <div className="id-stage">
        {img ? (
          <>
            {/* LCP: real catalog photo, not animated. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="id-stage-img id-lcp"
              src={img}
              alt=""
              width={640}
              height={480}
              fetchPriority="high"
              decoding="async"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="id-floor-reflect" src={img} alt="" aria-hidden="true" width={640} height={200} decoding="async" />
          </>
        ) : (
          <span className="id-ph" aria-hidden="true">
            <SchimitzMonogram size={72} ring />
          </span>
        )}
      </div>
      <div className="id-price-row">
        <div>
          <p className="id-pix-kicker id-mono">{pixOffLabel()}</p>
          <p className="id-price">
            <PriceCount value={pix} />
          </p>
          <p className="id-install">{installmentLine(price)}</p>
        </div>
        <Link className="id-buy" href={href}>
          Comprar <span aria-hidden="true">→</span>
        </Link>
      </div>
      <div className="id-lineup-head">
        <h2 className="id-display">
          A linha <i>completa</i>
        </h2>
        <span className="id-mono">
          {String(lineup.length).padStart(2, '0')} {lineup.length === 1 ? 'produto' : 'produtos'}
        </span>
      </div>
      <ul className="id-lineup">
        {lineup.map((product, tileIndex) => {
          const on = product.id === lead.id;
          const tilePix = pixPrice(Number(product.price));
          const tileImg = resolveProductImageUrl(product);
          return (
            <li key={product.id}>
            <button
              type="button"
              className={`id-tile${on ? ' is-on' : ''}`}
              aria-pressed={on}
              onClick={() => setActiveId(product.id)}
            >
              <span className="id-tile-face">
                <span className="id-tile-index id-mono">{String(tileIndex + 1).padStart(2, '0')}</span>
                {tileImg ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={tileImg} alt="" width={80} height={80} />
                ) : (
                  <SchimitzMonogram size={28} />
                )}
              </span>
              <span className="id-tile-name">{product.name}</span>
              <span className="id-tile-price">{brl(tilePix)}</span>
            </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function RetailHome({
  products,
  suppressStage = false,
}: {
  products: ProductType[];
  suppressStage?: boolean;
}) {
  const [settings, setSettings] = useState<StorePromo | null>(null);
  const [bestsellerIds, setBestsellerIds] = useState<Set<string>>(new Set());
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const offersRef = useReveal<HTMLElement>();
  const restRef = useReveal<HTMLElement>();
  const trustRef = useReveal<HTMLUListElement>();
  const reviewsRef = useReveal<HTMLElement>();

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
  const rest = useMemo(() => {
    const offerIds = new Set(offers.map((product) => product.id));
    return products.filter((product) => !offerIds.has(product.id));
  }, [offers, products]);
  const trust = useMemo(
    () => resolveRetailTrust({ trustItems: settings?.trustItems, cnpj: settings?.cnpj }),
    [settings],
  );
  const promoNote = configuredPromoLines(settings?.promoLines);

  return (
    <div className="home retail-home">
      {suppressStage ? null : <EditorialStage products={products} />}
      <HomeBanners products={products} placement="retail" />
      {promoNote ? <p className="sr-only">Faixa promocional configurada na loja.</p> : null}

      {offers.length ? (
        <section ref={offersRef} className="retail-offers" id="retail-vitrine" aria-labelledby="retail-offers-title">
          <div className="retail-offers-head">
            <div>
              <p className="retail-kicker">Hoje na loja</p>
              <h2 id="retail-offers-title">Ofertas do dia</h2>
            </div>
            {countdown ? <Countdown parts={countdown} /> : null}
          </div>
          <div className="retail-mosaic">
            {offers.map((product, index) => (
              <RetailTile
                key={product.id}
                product={product}
                bestseller={bestsellerIds.has(product.id)}
                lead={index === 0}
              />
            ))}
          </div>
        </section>
      ) : null}

      {rest.length ? (
        <section
          ref={restRef}
          className="retail-catalog"
          id={offers.length ? undefined : 'retail-vitrine'}
          aria-labelledby="retail-catalog-title"
        >
          <div className="section-head">
            <h2 id="retail-catalog-title">Na loja</h2>
            <span>{rest.length === 1 ? '1 produto' : `${rest.length} produtos`}</span>
          </div>
          <div className="retail-mosaic">
            {rest.map((product, index) => (
              <RetailTile
                key={product.id}
                product={product}
                bestseller={bestsellerIds.has(product.id)}
                lead={!offers.length && index === 0}
              />
            ))}
          </div>
        </section>
      ) : null}

      <ul ref={trustRef} className="retail-trust" aria-label="Confiança da loja">
        {trust.map((item: RetailTrustItem) => (
          <li key={item.id}>
            <strong>{item.title}</strong>
            <span>{item.body}</span>
          </li>
        ))}
      </ul>

      {reviews.length ? (
        <section ref={reviewsRef} className="retail-reviews" aria-labelledby="retail-reviews-title">
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
