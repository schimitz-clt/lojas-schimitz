'use client';

import { useRef } from 'react';
import { waLink } from '@/lib/api';
import {
  COMING_SOON_PRODUCTS,
  comingSoonBadgeLabel,
  comingSoonCardNote,
  comingSoonCtaLabel,
  comingSoonSubtitle,
  comingSoonTitle,
  comingSoonWhatsAppText,
} from '@/lib/coming-soon';
import { homeShelfNavNextLabel, homeShelfNavPrevLabel, homeShelfScrollAmount } from '@/lib/home-shelves';

/**
 * Horizontal teaser rail. Cards are not products: no price, no bag, no PDP.
 */
export function ComingSoonShelf() {
  const railRef = useRef<HTMLDivElement>(null);
  const titleId = 'home-soon-title';

  function scrollByDir(dir: -1 | 1) {
    const el = railRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * homeShelfScrollAmount(el.clientWidth), behavior: 'smooth' });
  }

  return (
    <section className="home-shelf home-shelf-soon" aria-labelledby={titleId}>
      <div className="section-head home-shelf-head section-head-accent">
        <div className="home-shelf-heading">
          <h2 id={titleId}>{comingSoonTitle()}</h2>
          <p className="home-shelf-sub muted">{comingSoonSubtitle()}</p>
        </div>
        <a href={waLink(comingSoonWhatsAppText())} target="_blank" rel="noopener noreferrer">
          {comingSoonCtaLabel()}
        </a>
      </div>
      <div className="home-shelf-viewport">
        <button
          type="button"
          className="home-shelf-nav home-shelf-prev"
          aria-label={homeShelfNavPrevLabel()}
          onClick={() => scrollByDir(-1)}
        >
          ‹
        </button>
        <div ref={railRef} className="home-shelf-rail" tabIndex={0}>
          {COMING_SOON_PRODUCTS.map((item) => (
            <article key={item.id} className="soon-card" aria-label={`${item.name}, em breve`}>
              <div className="soon-card-media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.icon} alt="" width={120} height={120} decoding="async" />
                <span className="soon-badge">{comingSoonBadgeLabel()}</span>
              </div>
              <div className="soon-card-body">
                <span className="soon-chip">{item.category}</span>
                <h3 className="soon-card-name">{item.name}</h3>
                <p className="soon-card-note">{comingSoonCardNote()}</p>
                <p className="sr-only">Prévia. Este item ainda não está à venda.</p>
              </div>
            </article>
          ))}
        </div>
        <button
          type="button"
          className="home-shelf-nav home-shelf-next"
          aria-label={homeShelfNavNextLabel()}
          onClick={() => scrollByDir(1)}
        >
          ›
        </button>
      </div>
    </section>
  );
}
