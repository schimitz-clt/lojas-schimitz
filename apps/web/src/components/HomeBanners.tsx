'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api, brl } from '@/lib/api';
import type { HomeBanner } from '@/lib/storefront';
import { INTEREST_FREE_INSTALLMENTS, interestFreeInstallmentClaim, pixPrice } from '@/lib/pricing';
import { discountPercent } from '@/lib/storefront-pro';
import {
  pickFeaturedHeroProduct,
  resolveRealProductImageUrl,
  type CatProductLike,
} from '@/lib/category-visual';
import {
  HOME_BANNER_AUTO_MS,
  HOME_BANNER_RESUME_MS,
  bannerAlt,
  bannerAriaLabel,
  bannerCtaHref,
  bannerCtaLabel,
  bannerDotLabel,
  bannerImageUrl,
  bannerNavNextLabel,
  bannerNavPrevLabel,
  bannerTapOpensLink,
  clampBannerIndex,
  nextBannerIndex,
  shouldShowBannerChrome,
  takeUsableHomeBanners,
} from '@/lib/home-banners';

type HeroProduct = CatProductLike & {
  id?: string;
  price?: number | string;
  slug?: string;
  compareAtPrice?: number | string | null;
  badge?: string | null;
};

/** Hero promocional branco + produto real quando a API não tem banners. */
function StaticPromoStrip({ featured }: { featured?: HeroProduct | null }) {
  const img = featured ? resolveRealProductImageUrl(featured) : '';
  const price = featured?.price != null ? Number(featured.price) : NaN;
  const hasPrice = Number.isFinite(price) && price > 0;
  const pix = hasPrice ? pixPrice(price) : null;
  const off = hasPrice ? discountPercent(price, featured?.compareAtPrice) : null;
  const href = featured?.slug ? `/produto/${featured.slug}` : '/departamento/ofertas';

  return (
    <section className="home-hero home-hero-light" aria-label="Destaques da loja">
      <div className="home-hero-grid">
        <div className="home-hero-copy">
          <p className="home-hero-kicker">Lojas Schimitz · Porto Alegre</p>
          <h2 className="home-hero-title">
            {featured?.name ? (
              <>
                Destaque da loja
                <span className="home-hero-product-name">{featured.name}</span>
              </>
            ) : (
              <>
                Ofertas todo dia.
                <span>Entrega rápida na capital.</span>
              </>
            )}
          </h2>
          {hasPrice ? (
            <div className="home-hero-price">
              {featured?.compareAtPrice ? (
                <span className="home-hero-compare">{brl(featured.compareAtPrice)}</span>
              ) : null}
              <span className="home-hero-price-main">{brl(price)}</span>
              {pix != null ? (
                <span className="home-hero-pix">
                  <strong>{brl(pix)}</strong> no PIX
                  {off ? <em>-{off}%</em> : <em>5% OFF</em>}
                </span>
              ) : null}
            </div>
          ) : (
            <p className="home-hero-sub">
              Frete grátis em POA · PIX 5% off · {interestFreeInstallmentClaim().toLowerCase()} · troca em 7 dias
            </p>
          )}
          <div className="home-hero-actions">
            <Link className="btn home-hero-cta" href={href}>
              {featured?.slug ? 'Ver produto' : 'Ver ofertas'}
            </Link>
            <Link className="btn ghost home-hero-ghost" href="/produtos">
              Explorar loja
            </Link>
          </div>
          <ul className="home-hero-chips" aria-label="Benefícios">
            <li>
              <strong>PIX</strong> 5% off
            </li>
            <li>
              <strong>{INTEREST_FREE_INSTALLMENTS}x</strong> sem juros
            </li>
            <li>
              <strong>Frete</strong> grátis POA
            </li>
          </ul>
        </div>
        <div className="home-hero-visual" aria-hidden={img ? undefined : true}>
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img}
              alt=""
              className="home-hero-product-img"
              width={560}
              height={560}
              sizes="(max-width: 720px) 70vw, 360px"
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />
          ) : (
            <div className="home-hero-visual-ph">
              <span>
                LOJAS <em>SCHIMITZ</em>
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function BannerSkeleton() {
  return (
    <section className="home-banners home-banners-skel" aria-hidden>
      <div className="home-banners-viewport">
        <div className="home-banner-track">
          <div className="home-banner-slide skel skel-media" />
        </div>
      </div>
    </section>
  );
}

export function HomeBanners({ products }: { products?: HeroProduct[] }) {
  const [banners, setBanners] = useState<HomeBanner[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [failedIds, setFailedIds] = useState<Set<string>>(() => new Set());
  const [paused, setPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const scrollSyncLock = useRef(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapOrigin = useRef<{ x: number; y: number } | null>(null);

  const featured = pickFeaturedHeroProduct(products || []);

  useEffect(() => {
    let cancelled = false;
    api<HomeBanner[]>('/store/banners')
      .then((d) => {
        if (cancelled) return;
        setBanners(takeUsableHomeBanners(Array.isArray(d) ? d : []));
        setFailedIds(new Set());
        setIdx(0);
      })
      .catch(() => {
        if (!cancelled) setBanners([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const slides = (banners || []).filter((b) => !failedIds.has(b.id));
  const total = slides.length;
  const multi = shouldShowBannerChrome(total);
  const safeIdx = clampBannerIndex(idx, total);

  const scrollToIndex = useCallback((n: number, smooth: boolean) => {
    const el = trackRef.current;
    if (!el) return;
    const w = el.clientWidth || 1;
    scrollSyncLock.current = true;
    el.scrollTo({ left: n * w, behavior: smooth ? 'smooth' : 'auto' });
    window.setTimeout(() => {
      scrollSyncLock.current = false;
    }, 350);
  }, []);

  const goTo = useCallback(
    (next: number) => {
      const target = clampBannerIndex(next, total);
      setIdx(target);
      scrollToIndex(target, true);
    },
    [scrollToIndex, total],
  );

  const go = useCallback(
    (delta: number) => {
      if (total <= 1) return;
      goTo(nextBannerIndex(safeIdx, total, delta));
    },
    [goTo, safeIdx, total],
  );

  const pauseAuto = useCallback(() => {
    setPaused(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setPaused(false), HOME_BANNER_RESUME_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!multi || paused) return;
    const t = setInterval(() => {
      setIdx((i) => {
        const next = nextBannerIndex(i, total, 1);
        scrollToIndex(next, true);
        return next;
      });
    }, HOME_BANNER_AUTO_MS);
    return () => clearInterval(t);
  }, [multi, paused, scrollToIndex, total]);

  useEffect(() => {
    setIdx((i) => clampBannerIndex(i, total));
  }, [total]);

  const onTrackScroll = useCallback(() => {
    const el = trackRef.current;
    if (scrollSyncLock.current || !el) return;
    const w = el.clientWidth || 1;
    const next = Math.round(el.scrollLeft / w);
    setIdx((cur) => (cur === next ? cur : next));
  }, []);

  const onSlidePointerDown = useCallback(
    (e: React.PointerEvent) => {
      tapOrigin.current = { x: e.clientX, y: e.clientY };
      pauseAuto();
    },
    [pauseAuto],
  );

  const onSlideClick = useCallback((e: React.MouseEvent) => {
    const origin = tapOrigin.current;
    tapOrigin.current = null;
    if (!origin) return;
    if (!bannerTapOpensLink(e.clientX - origin.x, e.clientY - origin.y)) {
      e.preventDefault();
    }
  }, []);

  if (banners === null) return <BannerSkeleton />;
  if (total === 0) return <StaticPromoStrip featured={featured} />;

  return (
    <section
      className="home-banners"
      aria-roledescription={multi ? 'carrossel' : undefined}
      aria-label={bannerAriaLabel(safeIdx, total)}
      tabIndex={multi ? 0 : undefined}
      onKeyDown={(e) => {
        if (!multi) return;
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          pauseAuto();
          go(1);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          pauseAuto();
          go(-1);
        }
      }}
    >
      <div className="home-banners-viewport">
        <div
          className="home-banner-track"
          ref={trackRef}
          onScroll={onTrackScroll}
          onPointerDown={pauseAuto}
        >
          {slides.map((b, i) => {
            const href = bannerCtaHref(b);
            const img = (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={bannerImageUrl(b)}
                alt={bannerAlt(b)}
                className="home-banner-img"
                width={1400}
                height={520}
                sizes="100vw"
                loading={i === 0 ? 'eager' : 'lazy'}
                fetchPriority={i === 0 ? 'high' : undefined}
                decoding="async"
                draggable={false}
                onError={() => {
                  setFailedIds((prev) => {
                    if (prev.has(b.id)) return prev;
                    const next = new Set(prev);
                    next.add(b.id);
                    return next;
                  });
                }}
              />
            );
            return (
              <div className="home-banner-slide" key={b.id}>
                <Link
                  href={href}
                  className="home-banner-link"
                  draggable={false}
                  onPointerDown={onSlidePointerDown}
                  onClick={onSlideClick}
                >
                  {img}
                  <div className="home-banner-overlay">
                    {b.title ? <p className="home-banner-caption">{b.title}</p> : null}
                    <span className="btn home-banner-cta">{bannerCtaLabel()}</span>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
        {multi ? (
          <>
            <button
              type="button"
              className="home-banner-nav home-banner-prev"
              aria-label={bannerNavPrevLabel()}
              onClick={() => {
                pauseAuto();
                go(-1);
              }}
            >
              ‹
            </button>
            <button
              type="button"
              className="home-banner-nav home-banner-next"
              aria-label={bannerNavNextLabel()}
              onClick={() => {
                pauseAuto();
                go(1);
              }}
            >
              ›
            </button>
          </>
        ) : null}
      </div>
      {multi ? (
        <div className="home-banner-dots" role="tablist" aria-label="Banners">
          {slides.map((b, i) => (
            <button
              key={b.id}
              type="button"
              className={i === safeIdx ? 'home-banner-dot active' : 'home-banner-dot'}
              aria-label={bannerDotLabel(i)}
              aria-selected={i === safeIdx}
              onClick={() => {
                pauseAuto();
                goTo(i);
              }}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
