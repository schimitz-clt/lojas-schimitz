'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ProductCard, type Product } from '@/components/ProductCard';
import { homeShelfNavNextLabel, homeShelfNavPrevLabel, homeShelfScrollAmount } from '@/lib/home-shelves';
import {
  RELATED_PRODUCTS_MAX,
  assembleRelatedProducts,
  bestsellersFromHomeShelves,
  parseCatalogProductItems,
  relatedProductsCopy,
  relatedShelfLink,
  shouldShowRelatedProducts,
  type RelatedKind,
} from '@/lib/pdp-trust';

type Props = {
  productId: string;
  productSlug: string;
  categorySlug?: string | null;
  categoryName?: string | null;
  initial?: Product[] | null;
  initialKind?: RelatedKind | null;
};

export function PdpRelatedProducts({
  productId,
  productSlug,
  categorySlug,
  categoryName,
  initial = null,
  initialKind = null,
}: Props) {
  const current = useMemo(
    () => ({ id: productId, slug: productSlug, categorySlug }),
    [productId, productSlug, categorySlug],
  );
  const [picked, setPicked] = useState(() => {
    if (initialKind && initial && initial.length) {
      return { items: initial, kind: initialKind };
    }
    return assembleRelatedProducts(current, { category: initial || [] }, RELATED_PRODUCTS_MAX);
  });
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const category = (categorySlug || '').trim();

    async function load() {
      let categoryItems: Product[] = [];
      if (category) {
        try {
          const data = await api<unknown>(
            `/products?category=${encodeURIComponent(category)}&pageSize=24`,
          );
          categoryItems = parseCatalogProductItems<Product>(data);
        } catch {
          categoryItems = [];
        }
      }
      if (cancelled) return;
      const fromCategory = assembleRelatedProducts(
        current,
        { category: categoryItems },
        RELATED_PRODUCTS_MAX,
      );
      if (fromCategory.kind === 'category' && fromCategory.items.length >= 2) {
        setPicked(fromCategory);
        return;
      }

      let bestsellers: Product[] = [];
      try {
        const shelves = await api<unknown>('/store/shelves');
        bestsellers = bestsellersFromHomeShelves<Product>(shelves);
      } catch {
        bestsellers = [];
      }
      if (cancelled) return;
      const withBest = assembleRelatedProducts(
        current,
        { category: categoryItems, bestsellers },
        RELATED_PRODUCTS_MAX,
      );
      if (
        withBest.items.length >= 2 &&
        (withBest.kind === 'category' || withBest.kind === 'bestsellers')
      ) {
        setPicked(withBest);
        return;
      }

      let catalog: Product[] = [];
      try {
        const all = await api<unknown>('/products?pageSize=24');
        catalog = parseCatalogProductItems<Product>(all);
      } catch {
        catalog = [];
      }
      if (cancelled) return;
      const filled = assembleRelatedProducts(
        current,
        { category: categoryItems, bestsellers, catalog },
        RELATED_PRODUCTS_MAX,
      );
      if (filled.items.length) {
        setPicked(filled);
        return;
      }
      if (!(initial && initial.length)) setPicked(filled);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [current, categorySlug, initial]);

  if (!shouldShowRelatedProducts(picked.items.length)) return null;

  const copy = relatedProductsCopy(picked.kind);
  const shelfLink = relatedShelfLink(picked.kind, categorySlug, categoryName);

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
        <Link href={shelfLink.href}>{shelfLink.label}</Link>
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
            <ProductCard key={`related-${p.id}`} p={p} variant="shelf" />
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
