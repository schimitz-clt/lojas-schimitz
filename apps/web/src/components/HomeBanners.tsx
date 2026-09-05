'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { HomeBanner } from '@/lib/storefront';

export function HomeBanners() {
  const [banners, setBanners] = useState<HomeBanner[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    api<HomeBanner[]>('/store/banners')
      .then((d) => setBanners(Array.isArray(d) ? d : []))
      .catch(() => setBanners([]));
  }, []);

  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % banners.length), 5500);
    return () => clearInterval(t);
  }, [banners.length]);

  if (!banners.length) return null;

  const current = banners[Math.min(idx, banners.length - 1)];
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={current.imageUrl}
      alt={current.alt || current.title || 'Banner'}
      className="home-banner-img"
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
