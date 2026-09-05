'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, brl, clearSession, currentUser } from '@/lib/api';

type Address = { id: string; label: string; street: string; number: string; city: string; uf: string; cep: string; isDefault: boolean };
type Loyalty = {
  balance: number;
  label: string;
  rate: number;
  recent: { id: string; kind: string; amount: number; note: string | null; createdAt: string }[];
};

const kindLabel: Record<string, string> = {
  earn: 'Cashback ganho',
  redeem: 'Usado no pedido',
  refund: 'Estorno',
};

export default function ContaPage() {
  const [user, setUser] = useState(currentUser());
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loyalty, setLoyalty] = useState<Loyalty | null>(null);
  const [form, setForm] = useState({ label: 'Casa', cep: '', street: '', number: '', district: '', city: '', uf: 'RS' });
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const u = currentUser();
    setUser(u);
    if (!u) {
      window.location.href = '/entrar';
      return;
    }
    api<Address[]>('/me/addresses').then(setAddresses).catch((e) => setErr(e.message));
    api<Loyalty>('/me/loyalty').then(setLoyalty).catch(() => {});
  }, []);

  async function addAddress(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api('/me/addresses', { method: 'POST', body: JSON.stringify(form) });
      setMsg('Endereço salvo.');
      const list = await api<Address[]>('/me/addresses');
      setAddresses(list);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  return (
    <div style={{ padding: '24px 0' }}>
      <div className="row">
        <h1>Minha conta</h1>
        <button className="btn ghost" onClick={() => { clearSession(); window.location.href = '/'; }}>Sair</button>
      </div>
      {user ? <p className="muted">{user.name} · {user.email} · {user.role}</p> : null}
      {err ? <div className="alert">{err}</div> : null}
      {msg ? <div className="ok">{msg}</div> : null}
      <p>
        <Link href="/pedidos">Meus pedidos</Link> · <Link href="/favoritos">Favoritos</Link> · <Link href="/carrinho">Sacola</Link>
        {user?.role === 'admin' ? <> · <Link href="/admin">Admin da loja</Link></> : null}
      </p>

      <section className="card" style={{ marginBottom: 24, borderColor: '#f5c518' }}>
        <div className="body">
          <h2 style={{ marginTop: 0, fontSize: 20 }}>SCHIMITZ+</h2>
          {loyalty ? (
            <>
              <p style={{ fontSize: 28, margin: '8px 0' }}>
                <b>{brl(loyalty.balance)}</b>
              </p>
              <p className="muted" style={{ marginTop: 0 }}>
                Cashback de {(loyalty.rate * 100).toFixed(0)}% em cada pedido pago. Use no checkout (parcial OK).
              </p>
              {loyalty.recent?.length ? (
                <div style={{ marginTop: 12 }}>
                  <h3 style={{ fontSize: 16, marginBottom: 8 }}>Extrato recente</h3>
                  {loyalty.recent.slice(0, 8).map((r) => (
                    <div key={r.id} className="row" style={{ fontSize: 14, marginBottom: 6 }}>
                      <span className="muted">{kindLabel[r.kind] || r.kind}</span>
                      <span style={{ color: r.kind === 'earn' || r.kind === 'refund' ? '#8f8' : undefined }}>
                        {r.kind === 'redeem' ? '−' : '+'}
                        {brl(r.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted" style={{ marginBottom: 0 }}>Ainda sem movimentos. Pague um pedido para começar a acumular.</p>
              )}
            </>
          ) : (
            <p className="muted">Carregando saldo...</p>
          )}
        </div>
      </section>

      <h3>Endereços</h3>
      {addresses.map((a) => (
        <div key={a.id} className="card" style={{ marginBottom: 8 }}>
          <div className="body">{a.label}: {a.street}, {a.number} — {a.city}/{a.uf} · CEP {a.cep}</div>
        </div>
      ))}
      <form className="form" onSubmit={addAddress}>
        <input placeholder="CEP" value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} required />
        <input placeholder="Rua" value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} required />
        <input placeholder="Número" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} required />
        <input placeholder="Bairro" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} required />
        <input placeholder="Cidade" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
        <input placeholder="UF" maxLength={2} value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value })} required />
        <button className="btn ghost" type="submit">Salvar endereço</button>
      </form>
      <p style={{ marginTop: 16 }}>
        <Link className="btn" href="/checkout">Ir ao checkout</Link>
      </p>
    </div>
  );
}
