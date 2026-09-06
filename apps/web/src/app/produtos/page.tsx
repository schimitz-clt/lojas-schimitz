'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ProductCard, Product } from '@/components/ProductCard';

function ProdutosInner() {
  const q = useSearchParams().get('q') || '';
  const [products, setProducts] = useState<Product[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const path = q ? `/products?q=${encodeURIComponent(q)}` : '/products';
    api<Product[] | { items: Product[] }>(path)
      .then((d) => setProducts(Array.isArray(d) ? d : d.items || []))
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erro ao carregar produtos'))
      .finally(() => setLoading(false));
  }, [q]);

  return (
    <div style={{ padding: '22px 0' }}>
      <h1>Produtos</h1>
      <p className="muted" style={{ marginBottom: 18 }}>
        Catálogo Lojas Schimitz
        {q ? <> · buscando “{q}”</> : null}.{' '}
        <Link href="/">Voltar ao início</Link>
      </p>
      {err ? <div className="alert">{err}</div> : null}
      {loading ? <p className="muted">Carregando produtos…</p> : null}
      {!loading && !err && products.length === 0 ? (
        <p className="muted">Nenhum produto encontrado. Tente outra busca ou explore os departamentos.</p>
      ) : null}
      <div className="grid">
        {products.map((p) => (
          <ProductCard key={p.id} p={p} />
        ))}
      </div>
    </div>
  );
}

export default function ProdutosPage() {
  return (
    <Suspense fallback={<p className="muted">Carregando…</p>}>
      <ProdutosInner />
    </Suspense>
  );
}
