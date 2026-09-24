'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api, brl, waLink } from '@/lib/api';
import { homeHeroEmptyCopy } from '@/lib/home-ux';
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
  HOME_BANNER_SETTLE_MS,
  bannerAlt,
  bannerAriaLabel,
  bannerCtaHref,
  bannerCtaLabel,
  bannerDotLabel,
  bannerImageIsPriority,
  bannerImagePreload,
  bannerImageUrl,
  bannerNavNextLabel,
  bannerNavPrevLabel,
  bannerScrollBehavior,
  bannerTapOpensLink,
  clampBannerIndex,
  homeBannerLoopSlides,
  homeBannerTrackLength,
  logicalFromTrackIndex,
  loopingAdvanceTrackIndex,
  loopingCloneJump,
  loopingTrackIndex,
  nextBannerIndex,
  shouldShowBannerChrome,
  takeUsableHomeBanners,
  trackIndexFromScroll,
} from '@/lib/home-banners';

type HeroProduct = CatProductLike & {
  id?: string;
  price?: number | string;
  slug?: string;
  compareAtPrice?: number | string | null;
  badge?: string | null;
};

/** Hero promocional branco + produto real quando a API não tem banners. */
function StaticPromoStrip({
  featured,
  catalogEmpty = false,
}: {
  featured?: HeroProduct | null;
  catalogEmpty?: boolean;
}) {
  if (catalogEmpty) {
    const copy = homeHeroEmptyCopy();
    return (
      <section className="home-hero home-hero-light home-hero-empty" aria-label="Vitrine em preparação">
        <div className="home-hero-grid">
          <div className="home-hero-copy">
            <p className="home-hero-kicker">{copy.kicker}</p>
            <h2 className="home-hero-title">
              {copy.title}
              <span className="home-hero-product-name">{copy.accent}</span>
            </h2>
            <p className="home-hero-sub">{copy.sub}</p>
            <div className="home-hero-actions">
              <Link className="btn home-hero-cta" href={copy.supportHref}>
                {copy.supportLabel}
              </Link>
              <a
                className="btn ghost home-hero-ghost"
                href={waLink(copy.whatsappText)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {copy.whatsappLabel}
              </a>
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
          <div className="home-hero-visual" aria-hidden>
            <div className="home-hero-visual-ph">
              <span>
                LOJAS <em>SCHIMITZ</em>
              </span>
            </div>
          </div>
        </div>
      </section>
    );
  }

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

export function HomeBanners({
  products,
  catalogEmpty = false,
}: {
  products?: HeroProduct[];
  catalogEmpty?: boolean;
}) {
  const [banners, setBanners] = useState<HomeBanner[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [failedIds, setFailedIds] = useState<Set<string>>(() => new Set());
  const [paused, setPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const idxRef = useRef(0);
  const interacting = useRef(false);
  const programmatic = useRef(false);
  const jumping = useRef(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapOrigin = useRef<{ x: number; y: number } | null>(null);
  const settleLoopRef = useRef<() => void>(() => {});

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
  const loopSlides = homeBannerLoopSlides(slides);
  const slideSetKey = slides.map((b) => b.id).join('|');
  idxRef.current = safeIdx;

  const pauseAuto = useCallback(() => {
    setPaused(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setPaused(false), HOME_BANNER_RESUME_MS);
  }, []);

  const scrollToTrack = useCallback(
    (trackIdx: number, smooth: boolean) => {
      const el = trackRef.current;
      if (!el || interacting.current) return;
      const w = el.clientWidth || 1;
      programmatic.current = true;
      el.scrollTo({ left: trackIdx * w, behavior: bannerScrollBehavior(smooth) });
      window.setTimeout(() => {
        programmatic.current = false;
        if (!interacting.current) settleLoopRef.current();
      }, smooth ? 280 : 0);
    },
    [],
  );

  const jumpToTrack = useCallback((trackIdx: number) => {
    const el = trackRef.current;
    if (!el || interacting.current) return;
    const width = el.clientWidth;
    if (width > 0 && Math.abs(el.scrollLeft - trackIdx * width) < 1) return;
    jumping.current = true;
    const snap = el.style.scrollSnapType;
    el.style.scrollSnapType = 'none';
    el.scrollLeft = trackIdx * (width || 1);
    el.style.scrollSnapType = snap;
    window.requestAnimationFrame(() => {
      jumping.current = false;
    });
  }, []);

  const settleLoop = useCallback(() => {
    if (interacting.current || jumping.current) return;
    const el = trackRef.current;
    if (!el || total <= 1) return;
    const trackCount = homeBannerTrackLength(total);
    const tIdx = trackIndexFromScroll(el.scrollLeft, el.clientWidth || 1, trackCount);
    const jump = loopingCloneJump(tIdx, total);
    if (jump == null) {
      const next = logicalFromTrackIndex(tIdx, total);
      setIdx((cur) => (cur === next ? cur : next));
      return;
    }
    jumpToTrack(jump);
    const next = logicalFromTrackIndex(jump, total);
    setIdx((cur) => (cur === next ? cur : next));
  }, [jumpToTrack, total]);
  settleLoopRef.current = settleLoop;

  const goTo = useCallback(
    (next: number, smooth = true) => {
      if (interacting.current) return;
      const target = clampBannerIndex(next, total);
      setIdx(target);
      scrollToTrack(loopingTrackIndex(target, total), smooth);
    },
    [scrollToTrack, total],
  );

  const go = useCallback(
    (delta: number) => {
      if (total <= 1 || interacting.current) return;
      const current = idxRef.current;
      const next = nextBannerIndex(current, total, delta);
      setIdx(next);
      scrollToTrack(loopingAdvanceTrackIndex(current, total, delta), true);
    },
    [scrollToTrack, total],
  );

  useEffect(() => {
    return () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, []);

  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el || total <= 1) return;
    jumpToTrack(loopingTrackIndex(clampBannerIndex(idxRef.current, total), total));
  }, [jumpToTrack, slideSetKey, total]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el || total <= 1) return;
    let lastTrackWidth = el.clientWidth;
    const onResize = () => {
      if (interacting.current || programmatic.current || jumping.current) return;
      const w = el.clientWidth;
      // Address-bar show/hide changes height, not width. Rewriting scrollLeft
      // on those observations hitches the page scroll that passes over the banner.
      if (Math.abs(w - lastTrackWidth) < 1) return;
      lastTrackWidth = w;
      jumpToTrack(loopingTrackIndex(idxRef.current, total));
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [jumpToTrack, total]);

  useEffect(() => {
    if (!multi || paused) return;
    const t = setInterval(() => {
      if (interacting.current) return;
      setIdx((i) => {
        const next = nextBannerIndex(i, total, 1);
        scrollToTrack(loopingAdvanceTrackIndex(i, total, 1), true);
        return next;
      });
    }, HOME_BANNER_AUTO_MS);
    return () => clearInterval(t);
  }, [multi, paused, scrollToTrack, total]);

  useEffect(() => {
    setIdx((i) => clampBannerIndex(i, total));
  }, [total]);

  const scheduleSettle = useCallback(() => {
    const tick = () => {
      const node = trackRef.current;
      const left = node ? node.scrollLeft : 0;
      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(() => {
        const now = trackRef.current;
        if (interacting.current || programmatic.current || jumping.current) return;
        if (now && Math.abs(now.scrollLeft - left) > 1) {
          tick();
          return;
        }
        settleLoopRef.current();
      }, HOME_BANNER_SETTLE_MS);
    };
    tick();
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el || total <= 1) return;
    const onEnd = () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = null;
      if (!interacting.current && !programmatic.current) settleLoop();
    };
    el.addEventListener('scrollend', onEnd);
    return () => el.removeEventListener('scrollend', onEnd);
  }, [settleLoop, total, slideSetKey]);

  const onTrackPointerDown = useCallback(() => {
    interacting.current = true;
    programmatic.current = false;
    pauseAuto();
  }, [pauseAuto]);

  useEffect(() => {
    const release = () => {
      if (!interacting.current) return;
      interacting.current = false;
      scheduleSettle();
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
  }, [scheduleSettle]);

  const onSlidePointerDown = useCallback(
    (e: React.PointerEvent) => {
      tapOrigin.current = { x: e.clientX, y: e.clientY };
      onTrackPointerDown();
    },
    [onTrackPointerDown],
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
  if (total === 0) return <StaticPromoStrip featured={featured} catalogEmpty={catalogEmpty} />;

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
          onPointerDown={onTrackPointerDown}
        >
          {loopSlides.map((slot) => {
            const b = slot.item;
            const priority = bannerImageIsPriority(slot.clone, slot.logicalIndex);
            const eager = bannerImagePreload(slot.clone, slot.logicalIndex, total);
            const href = bannerCtaHref(b);
            const img = (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={bannerImageUrl(b)}
                alt={slot.clone ? '' : bannerAlt(b)}
                className="home-banner-img"
                width={1400}
                height={520}
                sizes="100vw"
                loading={eager ? 'eager' : 'lazy'}
                fetchPriority={priority ? 'high' : 'low'}
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
              <div
                className="home-banner-slide"
                key={slot.key}
                aria-hidden={slot.clone ? true : undefined}
              >
                <Link
                  href={href}
                  className="home-banner-link"
                  draggable={false}
                  tabIndex={slot.clone ? -1 : undefined}
                  onPointerDown={onSlidePointerDown}
                  onDragStart={(e) => e.preventDefault()}
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
                goTo(i, false);
              }}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
