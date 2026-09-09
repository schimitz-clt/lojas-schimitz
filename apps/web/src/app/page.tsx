'use client';
import { useEffect, useMemo, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, waLink } from '@/lib/api';
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
    () => products.filter((p) => p.compareAtPrice || p.badge).slice(0, 8),
    [products],
  );
  const bestsellers = useMemo(() => {
    const ranked = [...products].sort(
      (a, b) => Number(b.ratingCount ?? 0) - Number(a.ratingCount ?? 0),
    );
    return ranked.slice(0, 8);
  }, [products]);
  const recommendations = useMemo(() => {
    const rest = products.filter((p) => !bestsellers.slice(0, 4).some((b) => b.id === p.id));
    return (rest.length ? rest : products).slice(0, 8);
  }, [products, bestsellers]);

  if (q) {
    return (
      <>
        <section style={{ padding: '18px 0 8px' }}>
          <h1 style={{ marginBottom: 6 }}>Resultados para “{q}”</h1>
          <p className="muted" style={{ marginTop: 0 }}>
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
    <>
      <HomeBanners />
      <section className="hero">
        <div className="badge">Vitrine · Lojas Schimitz</div>
        <h1>Tecnologia, conforto e praticidade para o seu dia a dia!</h1>
        <p>
          Busca, CEP, 12x, PIX 5% off, favoritos e sacola. Atendimento no chat do site ou no WhatsApp
          (51) 99625-3766.
        </p>
        <div className="actions">
          <a className="btn" href="#ofertas">
            Conferir ofertas
          </a>
          <a className="btn ghost" href={waLink()} target="_blank" rel="noreferrer">
            Falar no WhatsApp
          </a>
        </div>
      </section>

      <TrustBadges />

      <div className="section-head">
        <h2>Departamentos</h2>
        <Link href="/produtos">Ver todos</Link>
      </div>
      <nav className="cat-strip" aria-label="Categorias">
        {CATEGORIES.map((c) => (
          <Link key={c.href} href={c.href} className="cat-chip">
            <span className="cat-chip-ico" aria-hidden>
              {c.ico}
            </span>
            {c.label}
          </Link>
        ))}
      </nav>

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
          <section className="home-rail" id="ofertas">
            <div className="section-head">
              <h2>Ofertas do dia</h2>
              <Link href="/departamento/ofertas">Ver mais</Link>
            </div>
            <div className="grid">
              {(offers.length ? offers : products.slice(0, 8)).map((p, i) => (
                <ProductCard key={`o-${p.id}`} p={p} priority={i < 4} />
              ))}
            </div>
          </section>

          <section className="home-rail">
            <div className="section-head">
              <h2>Mais vendidos</h2>
              <Link href="/produtos?sort=relevance">Ver catálogo</Link>
            </div>
            <div className="grid">
              {bestsellers.map((p) => (
                <ProductCard key={`b-${p.id}`} p={p} />
              ))}
            </div>
          </section>

          <section className="home-rail">
            <div className="section-head">
              <h2>Recomendados para você</h2>
              <Link href="/produtos">Explorar</Link>
            </div>
            <div className="grid">
              {recommendations.map((p) => (
                <ProductCard key={`r-${p.id}`} p={p} />
              ))}
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<ProductGridSkeleton count={8} />}>
      <HomeInner />
    </Suspense>
  );
}
