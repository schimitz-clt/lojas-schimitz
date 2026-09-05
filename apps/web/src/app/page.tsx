'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, waLink } from '@/lib/api';
import { ProductCard, Product } from '@/components/ProductCard';
import { Suspense } from 'react';

function HomeInner() {
  const q = useSearchParams().get('q') || '';
  const [products, setProducts] = useState<Product[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    const path = q ? `/products?q=${encodeURIComponent(q)}` : '/products';
    api<Product[] | { items: Product[] }>(path)
      .then((d) => setProducts(Array.isArray(d) ? d : d.items || []))
      .catch((e) => setErr(e.message));
  }, [q]);

  return (
    <>
      <section className="hero">
        <div className="badge">Vitrine V1 · API própria</div>
        <h1>Tudo o que você precisa. No padrão das grandes.</h1>
        <p>Busca, CEP, 12x, PIX, favoritos, sacola e WhatsApp. Atendimento humano no (51) 99625-3766.</p>
        <div className="actions">
          <a className="btn" href="#ofertas">Conferir ofertas</a>
          <a className="btn ghost" href={waLink()} target="_blank" rel="noreferrer">Falar no WhatsApp</a>
        </div>
      </section>
      {err ? <div className="alert">API offline ou sem dados: {err}. Suba a API e rode o seed.</div> : null}
      <h2 id="ofertas">Ofertas do dia</h2>
      <div className="grid">
        {products.map((p) => <ProductCard key={p.id} p={p} />)}
      </div>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="muted">Carregando...</p>}>
      <HomeInner />
    </Suspense>
  );
}
