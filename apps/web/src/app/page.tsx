'use client';
import { useEffect, useMemo, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { ProductCard, Product } from '@/components/ProductCard';
import { HomeBanners } from '@/components/HomeBanners';
import { TrustBadges } from '@/components/TrustBadges';
import { ProductGridSkeleton } from '@/components/Skeleton';

type ListResponse = { items: Product[]; total?: number };

const CATEGORIES: { href: string; label: string; ico: string }[] = [
  { href: '/departamento/ofertas', label: 'Ofertas', ico: '🔥' },
  { href: '/departamento/celulares', label: 'Celulares', ico: '📱' },
  { href: '/departamento/informatica', label: 'Informática', ico: '💻' },
  { href: '/departamento/eletro', label: 'Eletro', ico: '📺' },
  { href: '/departamento/eletrodomesticos', label: 'Eletrodomésticos', ico: '🧊' },
  { href: '/departamento/casa', label: 'Casa', ico: '🏠' },
  { href: '/departamento/esporte', label: 'Esporte', ico: '⚽' },
  { href: '/marketplace', label: 'Marketplace', ico: '🏪' },
];

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

function ProductRail({
  products,
  priorityCount = 0,
  keyPrefix,
}: {
  products: Product[];
  priorityCount?: number;
  keyPrefix: string;
}) {
  return (
    <div className="grid grid-vitrine grid-rail">
      {products.map((p, i) => (
        <ProductCard key={`${keyPrefix}-${p.id}`} p={p} priority={i < priorityCount} />
      ))}
    </div>
  );
}

function HomeInner() {
  const q = useSearchParams().get('q') || '';
  const [products, setProducts] = useState<Product[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setErr('');
    const path = q ? `/products?q=${encodeURIComponent(q)}` : '/products';
    api<Product[] | ListResponse>(path)
      .then((d) => setProducts(Array.isArray(d) ? d : d.items || []))
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [q]);

  const offers = useMemo(
    () => products.filter((p) => p.compareAtPrice || p.badge).slice(0, 10),
    [products],
  );
  const bestsellers = useMemo(() => {
    const ranked = [...products].sort(
      (a, b) => Number(b.ratingCount ?? 0) - Number(a.ratingCount ?? 0),
    );
    return ranked.slice(0, 10);
  }, [products]);
  const recommendations = useMemo(() => {
    const rest = products.filter((p) => !bestsellers.slice(0, 4).some((b) => b.id === p.id));
    return (rest.length ? rest : products).slice(0, 10);
  }, [products, bestsellers]);

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
          <div className="alert">API offline ou sem dados: {err}. Suba a API e rode o seed.</div>
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
              <ProductCard key={p.id} p={p} priority={i < 4} />
            ))}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="home">
      <HomeBanners />

      <section className="home-cats" aria-labelledby="home-cats-title">
        <SectionHead id="home-cats-title" title="Categorias" href="/produtos" linkLabel="Ver todas" />
        <nav className="cat-strip" aria-label="Categorias">
          {CATEGORIES.map((c) => (
            <Link key={c.href} href={c.href} className="cat-chip">
              <span className="cat-chip-ico" aria-hidden>
                {c.ico}
              </span>
              <span className="cat-chip-label">{c.label}</span>
            </Link>
          ))}
        </nav>
      </section>

      <section className="home-benefits home-benefits-top" aria-labelledby="home-benefits-title">
        <h2 id="home-benefits-title" className="sr-only">
          Por que comprar na Schimitz
        </h2>
        <TrustBadges />
      </section>

      {err ? (
        <div className="alert">API offline ou sem dados: {err}. Suba a API e rode o seed.</div>
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

      {!loading && products.length > 0 ? (
        <>
          <section className="home-rail home-rail-offers" id="ofertas">
            <SectionHead
              title="Ofertas do dia"
              href="/departamento/ofertas"
              linkLabel="Ver todas"
              accent
            />
            <ProductRail
              products={offers.length ? offers : products.slice(0, 10)}
              priorityCount={4}
              keyPrefix="o"
            />
          </section>

          <section className="home-rail">
            <SectionHead title="Mais vendidos" href="/produtos?sort=relevance" linkLabel="Ver catálogo" />
            <ProductRail products={bestsellers} keyPrefix="b" />
          </section>

          <section className="home-rail">
            <SectionHead title="Recomendados para você" href="/produtos" linkLabel="Explorar" />
            <ProductRail products={recommendations} keyPrefix="r" />
          </section>
        </>
      ) : null}

      <section className="home-strip" aria-label="Benefícios Lojas Schimitz">
        <div className="home-strip-inner">
          <div>
            <p className="home-strip-kicker">Lojas Schimitz</p>
            <h2>Compra fácil, entrega rápida, atendimento real</h2>
            <p>
              Estoque e preços da loja física em Porto Alegre — com PIX, parcelamento e frete grátis
              na capital.
            </p>
          </div>
          <div className="home-strip-actions">
            <Link className="btn home-hero-cta" href="/produtos">
              Ver produtos
            </Link>
            <Link className="btn ghost home-hero-ghost" href="/suporte">
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
