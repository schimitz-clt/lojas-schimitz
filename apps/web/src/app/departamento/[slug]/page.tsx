'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { ProductCard, Product } from '@/components/ProductCard';

export default function DepartamentoPage() {
  const { slug } = useParams<{ slug: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    api<Product[]>(`/products?category=${slug}`).then(setProducts).catch((e) => setErr(e.message));
  }, [slug]);

  return (
    <div style={{ padding: '22px 0' }}>
      <h1 style={{ textTransform: 'capitalize' }}>{slug}</h1>
      {err ? <div className="alert">{err}</div> : null}
      <div className="grid">
        {products.map((p) => <ProductCard key={p.id} p={p} />)}
      </div>
    </div>
  );
}
