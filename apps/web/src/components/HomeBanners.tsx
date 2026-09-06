'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { HomeBanner } from '@/lib/storefront';

function isUsableBanner(b: HomeBanner | null | undefined): b is HomeBanner {
  if (!b || typeof b !== 'object') return false;
  const url = typeof b.imageUrl === 'string' ? b.imageUrl.trim() : '';
  return Boolean(url);
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

  // Loading or empty: render nothing — hero below fills the page (no empty box / broken layout).
  if (!banners || banners.length === 0) return null;

  const current = banners[Math.min(idx, banners.length - 1)];
  // Hide carousel on bad payload or broken image — avoid empty black box.
  if (!current || imgFailed) return null;

  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={current.imageUrl}
      alt={current.alt || current.title || 'Banner'}
      className="home-banner-img"
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
