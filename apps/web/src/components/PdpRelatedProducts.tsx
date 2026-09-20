'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ProductCard, type Product } from '@/components/ProductCard';
import { homeShelfNavNextLabel, homeShelfNavPrevLabel, homeShelfScrollAmount } from '@/lib/home-shelves';
import {
  RELATED_PRODUCTS_MAX,
  parseCatalogProductItems,
  pickRelatedProducts,
  relatedProductsCopy,
  relatedProductsHref,
  shouldShowRelatedProducts,
} from '@/lib/pdp-trust';

type Props = {
  productId: string;
  productSlug: string;
  categorySlug?: string | null;
  categoryName?: string | null;
  initial?: Product[] | null;
};

export function PdpRelatedProducts({
  productId,
  productSlug,
  categorySlug,
  categoryName,
  initial = null,
}: Props) {
  const [pool, setPool] = useState<Product[]>(() => initial || []);
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const category = (categorySlug || '').trim();
    const path = category
      ? `/products?category=${encodeURIComponent(category)}&pageSize=24`
      : '/products?pageSize=24';
    api<unknown>(path)
      .then((data) => {
        if (cancelled) return;
        const first = parseCatalogProductItems<Product>(data);
        if (first.length >= 2 || !category) {
          setPool(first);
          return;
        }
        return api<unknown>('/products?pageSize=24').then((all) => {
          if (!cancelled) {
            setPool([...first, ...parseCatalogProductItems<Product>(all)]);
          }
        });
      })
      .catch(() => {
        if (!cancelled && !(initial && initial.length)) setPool([]);
      });
    return () => {
      cancelled = true;
    };
  }, [productId, productSlug, categorySlug, initial]);

  const picked = useMemo(
    () =>
      pickRelatedProducts(
        { id: productId, slug: productSlug, categorySlug },
        pool.length ? pool : initial || [],
        RELATED_PRODUCTS_MAX,
      ),
    [productId, productSlug, categorySlug, pool, initial],
  );

  if (!shouldShowRelatedProducts(picked.items.length)) return null;

  const copy = relatedProductsCopy(picked.kind);
  const href = relatedProductsHref(categorySlug);
  const linkLabel = categoryName ? `Ver ${categoryName}` : 'Ver catálogo';

  function scrollByDir(dir: -1 | 1) {
    const el = railRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * homeShelfScrollAmount(el.clientWidth), behavior: 'smooth' });
  }

  return (
    <section className="pdp-related home-shelf" aria-labelledby="pdp-related-title">
      <div className="section-head home-shelf-head">
        <div className="home-shelf-heading">
          <h2 id="pdp-related-title">{copy.title}</h2>
          <p className="home-shelf-sub muted">{copy.subtitle}</p>
        </div>
        <Link href={href}>{linkLabel}</Link>
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
          {picked.items.map((p) => (
            <ProductCard key={`related-${p.id}`} p={p} />
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
