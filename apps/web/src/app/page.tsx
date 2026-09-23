'use client';
import { useEffect, useMemo, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { ProductCard, Product } from '@/components/ProductCard';
import { HomeBanners } from '@/components/HomeBanners';
import { HomeShortcuts } from '@/components/HomeShortcuts';
import { HomeShelves } from '@/components/HomeShelves';
import { ComingSoonShelf } from '@/components/ComingSoonShelf';
import { TrustBadges } from '@/components/TrustBadges';
import { ProductGridSkeleton } from '@/components/Skeleton';
import { HOME_CATEGORIES, categoryChipLabelLines, categoryCircleSrc } from '@/lib/category-visual';
import { RecentlyViewedStrip } from '@/components/RecentlyViewedStrip';
import { activeProductCountFromCatalog, shouldShowComingSoonShelf } from '@/lib/coming-soon';
import { HOME_CATALOG_LOAD_ERROR } from '@/lib/home-ux';
import {
  parseHomeShelvesPayload,
  shelvesFromCatalog,
  visibleHomeShelves,
  type HomeShelfView,
} from '@/lib/home-shelves';

type ListResponse = { items: Product[]; total?: number };

function SectionHead({
  id,
  title,
  href,
  linkLabel,
  accent,
}: {
  id?: string;
  title: string;
  href?: string;
  linkLabel?: string;
  accent?: boolean;
}) {
  return (
    <div className={`section-head${accent ? ' section-head-accent' : ''}`}>
      <h2 id={id}>{title}</h2>
      {href && linkLabel ? <Link href={href}>{linkLabel}</Link> : null}
    </div>
  );
}

function CategoryStrip({ products }: { products: Product[] }) {
  return (
    <nav className="cat-strip" aria-label="Categorias">
      {HOME_CATEGORIES.map((c, i) => {
        const src = categoryCircleSrc(products, c);
        const isFallback = src.startsWith('/cats/');
        const lines = categoryChipLabelLines(c.label);
        return (
          <Link key={c.href} href={c.href} className="cat-chip" aria-label={c.label}>
            <span className={`cat-chip-ico${isFallback ? ' cat-chip-ico-fallback' : ''}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                width={72}
                height={72}
                loading={i < 4 ? 'eager' : 'lazy'}
                fetchPriority="low"
                decoding="async"
                className="cat-chip-img"
              />
            </span>
            <span className="cat-chip-label" aria-hidden="true">
              {lines.map((line, lineIndex) => (
                <span key={`${lineIndex}-${line}`}>
                  {lineIndex > 0 ? <br className="cat-chip-label-break" /> : null}
                  {line}
                </span>
              ))}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function HomeInner() {
  const q = useSearchParams().get('q') || '';
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [shelves, setShelves] = useState<HomeShelfView<Product>[] | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setErr('');
    setActiveCount(null);
    const path = q ? `/products?q=${encodeURIComponent(q)}` : '/products?sort=newest&pageSize=48';
    let cancelled = false;
    (async () => {
      try {
        const catalog = await api<Product[] | ListResponse>(path);
        const items = Array.isArray(catalog) ? catalog : catalog.items || [];
        if (cancelled) return;
        setProducts(items);
        setActiveCount(activeProductCountFromCatalog(catalog));
        if (q) {
          setShelves(null);
          return;
        }
        try {
          const payload = await api<unknown>('/store/shelves');
          if (cancelled) return;
          const parsed = parseHomeShelvesPayload<Product>(payload);
          setShelves(parsed ?? shelvesFromCatalog(items));
        } catch {
          if (cancelled) return;
          setShelves(shelvesFromCatalog(items));
        }
      } catch (e) {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : 'Erro ao carregar');
        setProducts([]);
        setActiveCount(null);
        setShelves(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [q]);

  const visibleShelves = useMemo(() => visibleHomeShelves(shelves), [shelves]);
  const showComingSoon =
    !loading && !err && activeCount != null && shouldShowComingSoonShelf(activeCount);

  if (q) {
    return (
      <>
        <section className="home-search-head">
          <h1>Resultados para “{q}”</h1>
          <p className="muted">
            Busca na vitrine ·{' '}
            <Link href={`/produtos?q=${encodeURIComponent(q)}`}>ver no catálogo com filtros</Link>
          </p>
        </section>
        {err ? (
          <div className="alert" role="alert">{HOME_CATALOG_LOAD_ERROR}</div>
        ) : null}
        {loading ? <ProductGridSkeleton count={8} /> : null}
        {!loading && !err && products.length === 0 ? (
          <div className="catalog-empty">
            <p style={{ margin: 0, fontWeight: 700 }}>Não encontramos resultados para “{q}”.</p>
            <p className="muted" style={{ margin: '8px 0 12px' }}>
              Tente outra busca ou confira o <Link href="/produtos">catálogo completo</Link>.
            </p>
            <Link className="btn ghost" href="/">
              Limpar busca
            </Link>
          </div>
        ) : null}
        {!loading ? (
          <div className="grid">
            {products.map((p, i) => (
              <ProductCard key={p.id} p={p} priority={i < 4} variant="shelf" />
            ))}
          </div>
        ) : null}
        <RecentlyViewedStrip />
      </>
    );
  }

  return (
    <div className="home sf-pro-home">
      {/* 1. Banner / hero */}
      <HomeBanners products={loading ? [] : products} />

      {/* Shortcuts sit above Categorias — the photo strip stays. */}
      <HomeShortcuts />

      {/* 2. Categories — photo circles, no emoji */}
      <section className="home-cats" id="home-cats" aria-labelledby="home-cats-title">
        <SectionHead id="home-cats-title" title="Categorias" href="/produtos" linkLabel="Ver todas" />
        <CategoryStrip products={products} />
      </section>

      {err ? (
        <div className="alert" role="alert">{HOME_CATALOG_LOAD_ERROR}</div>
      ) : null}

      {loading ? <ProductGridSkeleton count={8} /> : null}

      {!loading && !err && products.length === 0 ? (
        <div className="catalog-empty">
          <p style={{ margin: 0, fontWeight: 700 }}>Nenhuma oferta no momento.</p>
          <p className="muted" style={{ margin: '8px 0 12px' }}>
            Confira o <Link href="/produtos">catálogo completo</Link> e os{' '}
            <Link href="/departamento/ofertas">departamentos</Link>.
          </p>
        </div>
      ) : null}

      {/* Teaser only while GET /products has zero active items. */}
      {showComingSoon ? <ComingSoonShelf /> : null}

      {/* 3–5. Prateleiras Magalu — Ofertas / Novidades / Mais vendidos */}
      {!loading && visibleShelves.length > 0 ? <HomeShelves shelves={visibleShelves} /> : null}

      <RecentlyViewedStrip />

      {/* 6. Benefits → then footer (layout) */}
      <section className="home-benefits" aria-labelledby="home-benefits-title">
        <h2 id="home-benefits-title" className="sr-only">
          Por que comprar na Schimitz
        </h2>
        <TrustBadges />
      </section>

      <section className="home-strip" aria-label="Benefícios Lojas Schimitz">
        <div className="home-strip-inner">
          <div>
            <p className="home-strip-kicker">Lojas Schimitz</p>
            <h2>Compra fácil, entrega rápida.</h2>
            <p>
              Estoque e preços da loja física em Porto Alegre — com PIX, parcelamento e frete grátis
              na capital.
            </p>
          </div>
          <div className="home-strip-actions">
            <Link className="btn home-hero-cta" href="/produtos">
              Ver produtos
            </Link>
            <Link className="btn ghost home-hero-ghost-light" href="/suporte">
              Falar com a loja
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<ProductGridSkeleton count={8} />}>
      <HomeInner />
    </Suspense>
  );
}
