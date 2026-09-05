'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ProductCard, Product } from '@/components/ProductCard';

export default function FavoritosPage() {
  const [items, setItems] = useState<{ id: string; product: Product }[]>([]);
  const [err, setErr] = useState('');
  useEffect(() => {
    api<any[]>('/favorites').then(setItems).catch((e) => setErr(e.message));
  }, []);
  return (
    <div style={{ padding: '24px 0' }}>
      <h1>Favoritos</h1>
      {err ? <div className="alert">{err} — entre na conta para ver favoritos.</div> : null}
      <div className="grid">{items.map((i) => <ProductCard key={i.id} p={i.product} />)}</div>
    </div>
  );
}
