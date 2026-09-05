'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, clearSession, currentUser } from '@/lib/api';

type Address = { id: string; label: string; street: string; number: string; city: string; uf: string; cep: string; isDefault: boolean };

export default function ContaPage() {
  const [user, setUser] = useState(currentUser());
  const [addresses, setAddresses] = useState<Address[]>([]);
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

  async function checkout() {
    const addr = addresses.find((a) => a.isDefault) || addresses[0];
    if (!addr) {
      setErr('Cadastre um endereço antes de finalizar.');
      return;
    }
    try {
      const order = await api<any>('/orders', { method: 'POST', body: JSON.stringify({ addressId: addr.id, couponCode: 'PIX5' }) });
      window.location.href = `/pedidos/${order.publicId}`;
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
      <p><Link href="/pedidos">Meus pedidos</Link> · <Link href="/favoritos">Favoritos</Link> · <Link href="/carrinho">Sacola</Link></p>
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
      <p><button className="btn" onClick={checkout}>Finalizar pedido com o endereço padrão</button></p>
    </div>
  );
}
