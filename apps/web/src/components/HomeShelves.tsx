'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { ProductCard, type Product } from '@/components/ProductCard';
import {
  homeShelfNavNextLabel,
  homeShelfNavPrevLabel,
  homeShelfScrollAmount,
  visibleHomeShelves,
  type HomeShelfView,
} from '@/lib/home-shelves';

function ShelfHead({
  id,
  title,
  subtitle,
  href,
  linkLabel,
  accent,
}: {
  id: string;
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
  accent?: boolean;
}) {
  return (
    <div className={`section-head home-shelf-head${accent ? ' section-head-accent' : ''}`}>
      <div className="home-shelf-heading">
        <h2 id={id}>{title}</h2>
        {subtitle ? <p className="home-shelf-sub muted">{subtitle}</p> : null}
      </div>
      {href && linkLabel ? <Link href={href}>{linkLabel}</Link> : null}
    </div>
  );
}

function ShelfRail({
  shelf,
  priorityCount = 0,
}: {
  shelf: HomeShelfView<Product>;
  priorityCount?: number;
}) {
  const railRef = useRef<HTMLDivElement>(null);

  function scrollByDir(dir: -1 | 1) {
    const el = railRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * homeShelfScrollAmount(el.clientWidth), behavior: 'smooth' });
  }

  return (
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
        {shelf.items.map((product, i) => (
          <ProductCard
            key={`${shelf.id}-${product.id}`}
            p={product}
            priority={i < priorityCount}
            variant="shelf"
          />
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
  );
}

export function HomeShelves({
  shelves,
}: {
  shelves: HomeShelfView<Product>[] | null | undefined;
}) {
  const visible = visibleHomeShelves(shelves);
  if (!visible.length) return null;

  return (
    <div className="home-shelves">
      {visible.map((shelf) => (
        <section
          key={shelf.id}
          className={`home-shelf home-shelf-${shelf.id}`}
          id={shelf.id === 'offers' ? 'ofertas' : undefined}
          aria-labelledby={`home-shelf-${shelf.id}-title`}
        >
          <ShelfHead
            id={`home-shelf-${shelf.id}-title`}
            title={shelf.title}
            subtitle={shelf.subtitle}
            href={shelf.href}
            linkLabel={shelf.linkLabel}
            accent={shelf.id === 'offers'}
          />
          <ShelfRail shelf={shelf} priorityCount={shelf.id === 'offers' ? 4 : 0} />
        </section>
      ))}
    </div>
  );
}
