'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { ProductCard, Product } from '@/components/ProductCard';

type ListResponse = { items: Product[] };

export default function DepartamentoPage() {
  const { slug } = useParams<{ slug: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api<Product[] | ListResponse>(`/products?category=${encodeURIComponent(slug)}&sort=newest`)
      .then((d) => setProducts(Array.isArray(d) ? d : d.items || []))
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <div style={{ padding: '22px 0' }}>
      <h1 style={{ textTransform: 'capitalize' }}>{slug}</h1>
      <p className="muted" style={{ marginBottom: 14 }}>
        <Link href="/produtos">Catálogo</Link>
        <span> · </span>
        <Link href={`/produtos?category=${encodeURIComponent(slug)}`}>Filtros nesta categoria</Link>
      </p>
      {err ? <div className="alert">{err}</div> : null}
      {loading ? <p className="muted">Carregando…</p> : null}
      {!loading && !err && products.length === 0 ? (
        <div className="catalog-empty">
          <p style={{ margin: 0, fontWeight: 700 }}>Nenhum produto neste departamento.</p>
          <p className="muted" style={{ margin: '8px 0 0' }}>
            Veja todos os <Link href="/produtos">produtos</Link> ou o{' '}
            <Link href="/marketplace">marketplace</Link>.
          </p>
        </div>
      ) : null}
      <div className="grid">
        {products.map((p) => (
          <ProductCard key={p.id} p={p} />
        ))}
      </div>
    </div>
  );
}
