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

/** Faixa promocional estática (só texto/CSS) quando a API não tem banners. */
function StaticPromoStrip() {
  return (
    <section className="home-promo" aria-label="Destaques da loja">
      <div className="home-promo-inner">
        <p className="home-promo-kicker">Lojas Schimitz · Porto Alegre</p>
        <h2 className="home-promo-title">Frete grátis em POA · PIX 5% off · até 12x</h2>
        <p className="home-promo-sub">
          Entrega própria, troca em 7 dias e atendimento no chat ou WhatsApp.
        </p>
        <div className="home-promo-actions">
          <Link className="btn" href="/produtos">
            Ver produtos
          </Link>
          <Link className="btn ghost" href="/departamento/ofertas">
            Ofertas
          </Link>
          <Link className="btn ghost" href="/suporte">
            Suporte
          </Link>
        </div>
        <ul className="home-promo-chips" aria-label="Benefícios">
          <li>Frete grátis POA</li>
          <li>PIX 5%</li>
          <li>12x Mercado Pago</li>
          <li>Troca 7 dias</li>
        </ul>
      </div>
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

  // Loading: evita flash da faixa estática antes da API responder.
  if (banners === null) return null;

  // Sem banners (ou imagem quebrada): faixa promocional de texto.
  if (banners.length === 0) return <StaticPromoStrip />;

  const current = banners[Math.min(idx, banners.length - 1)];
  if (!current || imgFailed) return <StaticPromoStrip />;

  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={bannerImageUrl(current)}
      alt={current.alt || current.title || 'Banner'}
      className="home-banner-img"
      width={1200}
      height={457}
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
        {current.title ? <div className="home-banner-caption">{current.title}</div> : null}
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
