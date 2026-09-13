'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { HomeBanner } from '@/lib/storefront';
import { isMissingOrPlaceholderImage } from '@/lib/placeholder-image';
import { rewritePublicUploadUrl } from '@/lib/public-upload-url';

function isUsableBanner(b: HomeBanner | null | undefined): b is HomeBanner {
  if (!b || typeof b !== 'object') return false;
  const raw = typeof b.imageUrl === 'string' ? b.imageUrl.trim() : '';
  const url = rewritePublicUploadUrl(raw) || raw;
  return Boolean(url) && !isMissingOrPlaceholderImage(url);
}

function bannerImageUrl(b: HomeBanner): string {
  const raw = (b.imageUrl || '').trim();
  return rewritePublicUploadUrl(raw) || raw;
}

/** Hero promocional de alto impacto quando a API não tem banners. */
function StaticPromoStrip() {
  return (
    <section className="home-hero" aria-label="Destaques da loja">
      <div className="home-hero-glow" aria-hidden />
      <div className="home-hero-inner">
        <p className="home-hero-kicker">Lojas Schimitz · Porto Alegre</p>
        <h2 className="home-hero-title">
          Ofertas todo dia.
          <br />
          <span>Entrega rápida na capital.</span>
        </h2>
        <p className="home-hero-sub">
          Frete grátis em POA · PIX 5% off · até 12x sem juros · troca em 7 dias
        </p>
        <div className="home-hero-actions">
          <Link className="btn home-hero-cta" href="/departamento/ofertas">
            Ver ofertas
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
            <strong>12x</strong> sem juros
          </li>
          <li>
            <strong>Frete</strong> grátis POA
          </li>
          <li>
            <strong>Troca</strong> 7 dias
          </li>
        </ul>
      </div>
    </section>
  );
}

function BannerSkeleton() {
  return (
    <section className="home-banners home-banners-skel" aria-hidden>
      <div className="home-banner-slide skel skel-media" />
    </section>
  );
}

export function HomeBanners() {
  const [banners, setBanners] = useState<HomeBanner[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<HomeBanner[]>('/store/banners')
      .then((d) => {
        if (cancelled) return;
        const list = (Array.isArray(d) ? d : []).filter(isUsableBanner);
        setBanners(list);
      })
      .catch(() => {
        if (!cancelled) setBanners([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!banners || banners.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % banners.length), 5500);
    return () => clearInterval(t);
  }, [banners]);

  useEffect(() => {
    setImgFailed(false);
  }, [idx, banners]);

  if (banners === null) return <BannerSkeleton />;
  if (banners.length === 0) return <StaticPromoStrip />;

  const current = banners[Math.min(idx, banners.length - 1)];
  if (!current || imgFailed) return <StaticPromoStrip />;

  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={bannerImageUrl(current)}
      alt={current.alt || current.title || 'Banner'}
      className="home-banner-img"
      width={1400}
      height={520}
      sizes="100vw"
      loading="eager"
      fetchPriority="high"
      decoding="async"
      onError={() => setImgFailed(true)}
    />
  );

  return (
    <section className="home-banners" aria-label="Destaques">
      <div className="home-banner-slide">
        {current.linkUrl ? (
          <a href={current.linkUrl} className="home-banner-link">
            {img}
          </a>
        ) : (
          img
        )}
        <div className="home-banner-overlay">
          {current.title ? <p className="home-banner-caption">{current.title}</p> : null}
          <Link className="btn home-banner-cta" href={current.linkUrl || '/departamento/ofertas'}>
            Conferir agora
          </Link>
        </div>
        {banners.length > 1 ? (
          <>
            <button
              type="button"
              className="home-banner-nav home-banner-prev"
              aria-label="Banner anterior"
              onClick={() => setIdx((i) => (i - 1 + banners.length) % banners.length)}
            >
              ‹
            </button>
            <button
              type="button"
              className="home-banner-nav home-banner-next"
              aria-label="Próximo banner"
              onClick={() => setIdx((i) => (i + 1) % banners.length)}
            >
              ›
            </button>
          </>
        ) : null}
      </div>
      {banners.length > 1 ? (
        <div className="home-banner-dots" role="tablist" aria-label="Banners">
          {banners.map((b, i) => (
            <button
              key={b.id}
              type="button"
              className={i === idx ? 'home-banner-dot active' : 'home-banner-dot'}
              aria-label={`Banner ${i + 1}`}
              aria-selected={i === idx}
              onClick={() => setIdx(i)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
