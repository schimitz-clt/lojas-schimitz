'use client';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, waLink } from '@/lib/api';
import { ProductCard, Product } from '@/components/ProductCard';
import { HomeBanners } from '@/components/HomeBanners';
import { TrustBadges } from '@/components/TrustBadges';
import { ProductGridSkeleton } from '@/components/Skeleton';

type ListResponse = { items: Product[]; total?: number };

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

  return (
    <>
      {!q ? <HomeBanners /> : null}
      {!q ? (
        <section className="hero">
          <div className="badge">Vitrine · Lojas Schimitz</div>
          <h1>Tudo o que você precisa. No padrão das grandes.</h1>
          <p>
            Busca, CEP, 12x, PIX, favoritos, sacola e chat. Atendimento no chat do site ou no WhatsApp
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
      ) : (
        <section style={{ padding: '18px 0 8px' }}>
          <h1 style={{ marginBottom: 6 }}>Resultados para “{q}”</h1>
          <p className="muted" style={{ marginTop: 0 }}>
            Busca na vitrine ·{' '}
            <Link href={`/produtos?q=${encodeURIComponent(q)}`}>ver no catálogo com filtros</Link>
          </p>
        </section>
      )}
      {!q ? <TrustBadges /> : null}
      {err ? (
        <div className="alert">API offline ou sem dados: {err}. Suba a API e rode o seed.</div>
      ) : null}
      <h2 id="ofertas" style={{ fontSize: 20, margin: '8px 0 14px' }}>
        {q ? 'Produtos encontrados' : 'Ofertas do dia'}
      </h2>
      {loading ? <ProductGridSkeleton count={8} /> : null}
      {!loading && !err && products.length === 0 ? (
        <div className="catalog-empty">
          <p style={{ margin: 0, fontWeight: 700 }}>
            {q ? `Não encontramos resultados para “${q}”.` : 'Nenhuma oferta no momento.'}
          </p>
          <p className="muted" style={{ margin: '8px 0 12px' }}>
            Tente outra busca ou confira o{' '}
            <Link href="/produtos">catálogo completo</Link> e os{' '}
            <Link href="/departamento/ofertas">departamentos</Link>.
          </p>
          {q ? (
            <Link className="btn ghost" href="/">
              Limpar busca
            </Link>
          ) : null}
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

export default function Page() {
  return (
    <Suspense fallback={<ProductGridSkeleton count={8} />}>
      <HomeInner />
    </Suspense>
  );
}
