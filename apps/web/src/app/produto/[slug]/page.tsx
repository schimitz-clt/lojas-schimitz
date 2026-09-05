'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, brl, getGuestToken, waLink } from '@/lib/api';

type Detail = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: string | number;
  compareAtPrice?: string | number | null;
  badge?: string | null;
  images?: { url: string }[];
  inventory?: { qtyOnHand: number; qtyReserved: number } | null;
};

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const [p, setP] = useState<Detail | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    getGuestToken();
    api<Detail>(`/products/${slug}`).then(setP).catch((e) => setErr(e.message));
  }, [slug]);

  async function add() {
    if (!p) return;
    try {
      await api('/cart/items', { method: 'POST', body: JSON.stringify({ productId: p.id, qty: 1 }) });
      setMsg('Adicionado à sacola.');
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function fav() {
    if (!p) return;
    try {
      await api('/favorites', { method: 'POST', body: JSON.stringify({ productId: p.id }) });
      setMsg('Salvo nos favoritos.');
    } catch (e: any) {
      setErr(e.message);
    }
  }

  if (err && !p) return <div className="alert" style={{ marginTop: 24 }}>{err}</div>;
  if (!p) return <p className="muted">Carregando...</p>;
  const stock = p.inventory ? p.inventory.qtyOnHand - p.inventory.qtyReserved : 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) 1fr', gap: 24, padding: '24px 0' }}>
      <div className="card">
        <img src={p.images?.[0]?.url} alt={p.name} />
      </div>
      <div>
        {p.badge ? <div className="badge">{p.badge}</div> : null}
        <h1>{p.name}</h1>
        <p className="muted">{p.description}</p>
        <p>
          <span className="price">{brl(p.price)}</span>
          {p.compareAtPrice ? <span className="compare">{brl(p.compareAtPrice)}</span> : null}
        </p>
        <p className="muted">Estoque: {stock} · 12x sem juros · 5% off no PIX</p>
        {msg ? <p className="ok">{msg}</p> : null}
        {err ? <p className="alert">{err}</p> : null}
        <div className="actions">
          <button className="btn" onClick={add}>Adicionar à sacola</button>
          <button className="btn ghost" onClick={fav}>Favoritar</button>
          <a className="btn wa" href={waLink(`Olá, quero o produto ${p.name}`)} target="_blank" rel="noreferrer">WhatsApp</a>
        </div>
      </div>
    </div>
  );
}
