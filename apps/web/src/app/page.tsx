import { Suspense } from 'react';
import Link from 'next/link';
import { ProductCard, type Product } from '@/components/ProductCard';
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
  catalogProductsFromResponse,
  parseHomeShelvesPayload,
  shelvesFromCatalog,
  visibleHomeShelves,
  type HomeShelfView,
} from '@/lib/home-shelves';
import { fetchStoreData, type StoreDataResult } from '@/lib/storefront';
import { takeUsableHomeBanners, type HomeBanner } from '@/lib/home-banners';

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
          <Link key={c.href} href={c.href} className="cat-chip" aria-label={c.label} prefetch={true}>
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

function readCatalog(result: StoreDataResult): {
  items: Product[];
  activeCount: number | null;
  err: boolean;
} {
  if (!result.ok) return { items: [], activeCount: null, err: true };
  return {
    items: catalogProductsFromResponse<Product>(result.data),
    activeCount: activeProductCountFromCatalog(result.data),
    err: false,
  };
}

function readBanners(result: StoreDataResult): HomeBanner[] | null {
  if (!result.ok || !Array.isArray(result.data)) return null;
  return result.data as HomeBanner[];
}

function readShelves(result: StoreDataResult | null, items: Product[]): HomeShelfView<Product>[] | null {
  if (!result || !result.ok) return shelvesFromCatalog(items);
  return parseHomeShelvesPayload<Product>(result.data) ?? shelvesFromCatalog(items);
}

function HomeSearch({ q, catalogRes }: { q: string; catalogRes: StoreDataResult }) {
  const { items, err } = readCatalog(catalogRes);
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
      {!err && items.length === 0 ? (
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
      {!err ? (
        <div className="grid">
          {items.map((p, i) => (
            <ProductCard key={p.id} p={p} priority={i < 4} variant="shelf" />
          ))}
        </div>
      ) : null}
      <RecentlyViewedStrip />
    </>
  );
}

function HomeLower({
  items,
  err,
  activeCount,
  shelves,
}: {
  items: Product[];
  err: boolean;
  activeCount: number | null;
  shelves: HomeShelfView<Product>[] | null;
}) {
  const visibleShelves = visibleHomeShelves(shelves);
  const showComingSoon = !err && activeCount != null && shouldShowComingSoonShelf(activeCount);
  return (
    <>
      <section className="home-cats" id="home-cats" aria-labelledby="home-cats-title">
        <SectionHead id="home-cats-title" title="Categorias" href="/produtos" linkLabel="Ver todas" />
        <CategoryStrip products={items} />
      </section>

      {err ? (
        <div className="alert" role="alert">{HOME_CATALOG_LOAD_ERROR}</div>
      ) : null}

      {!err && items.length === 0 ? (
        <div className="catalog-empty">
          <p style={{ margin: 0, fontWeight: 700 }}>Nenhuma oferta no momento.</p>
          <p className="muted" style={{ margin: '8px 0 12px' }}>
            Confira o <Link href="/produtos">catálogo completo</Link> e os{' '}
            <Link href="/departamento/ofertas">departamentos</Link>.
          </p>
        </div>
      ) : null}

      {showComingSoon ? <ComingSoonShelf /> : null}

      {!err && visibleShelves.length > 0 ? <HomeShelves shelves={visibleShelves} /> : null}

      <RecentlyViewedStrip />

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
    </>
  );
}

async function HomeCatalogBlock({
  catalogPromise,
  shelvesPromise,
}: {
  catalogPromise: Promise<StoreDataResult>;
  shelvesPromise: Promise<StoreDataResult>;
}) {
  const [catalogRes, shelvesRes] = await Promise.all([catalogPromise, shelvesPromise]);
  const { items, activeCount, err } = readCatalog(catalogRes);
  return (
    <HomeLower
      items={items}
      err={err}
      activeCount={activeCount}
      shelves={err ? null : readShelves(shelvesRes, items)}
    />
  );
}

async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const sp = await searchParams;
  const rawQ = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const q = (rawQ || '').trim();

  if (q) {
    const catalogRes = await fetchStoreData(`/products?q=${encodeURIComponent(q)}`);
    return <HomeSearch q={q} catalogRes={catalogRes} />;
  }

  // Banners decide the hero. Catalog + shelves stay in flight so a slow rail
  // does not hold the first banner bitmap.
  const catalogPromise = fetchStoreData('/products?sort=newest&pageSize=48');
  const shelvesPromise = fetchStoreData('/store/shelves');
  const bannerRes = await fetchStoreData('/store/banners');
  const initialBanners = readBanners(bannerRes);
  const usable = initialBanners ? takeUsableHomeBanners(initialBanners) : [];

  if (!initialBanners || usable.length === 0) {
    const [catalogRes, shelvesRes] = await Promise.all([catalogPromise, shelvesPromise]);
    const { items, activeCount, err } = readCatalog(catalogRes);
    return (
      <div className="home sf-pro-home">
        <HomeBanners products={err ? [] : items} initialBanners={initialBanners} />
        <HomeShortcuts />
        <HomeLower
          items={items}
          err={err}
          activeCount={activeCount}
          shelves={err ? null : readShelves(shelvesRes, items)}
        />
      </div>
    );
  }

  return (
    <div className="home sf-pro-home">
      <HomeBanners products={[]} initialBanners={initialBanners} />
      <HomeShortcuts />
      <Suspense fallback={<ProductGridSkeleton count={8} />}>
        <HomeCatalogBlock catalogPromise={catalogPromise} shelvesPromise={shelvesPromise} />
      </Suspense>
    </div>
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<ProductGridSkeleton count={8} />}>
      <HomePage searchParams={searchParams} />
    </Suspense>
  );
}
