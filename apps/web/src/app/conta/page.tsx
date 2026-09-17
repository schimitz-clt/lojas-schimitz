'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, brl, clearSession, currentUser } from '@/lib/api';
import { orderStatusLabel } from '@/lib/order-status';
import { orderRecoveryPaths } from '@/lib/order-recovery';
import { pickInProgressOrder } from '@/lib/pix-payment-ui';

type Address = { id: string; label: string; street: string; number: string; city: string; uf: string; cep: string; isDefault: boolean };
type Loyalty = {
  balance: number;
  label: string;
  rate: number;
  recent: { id: string; kind: string; amount: number; note: string | null; createdAt: string }[];
};
type CustomerOrder = {
  id: string;
  publicId: string;
  status: string;
  total: number;
  payments?: { status: string; method: string }[];
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
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);
  const [form, setForm] = useState({ label: 'Casa', cep: '', street: '', number: '', district: '', city: '', uf: 'RS' });
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [phone, setPhone] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);

  useEffect(() => {
    const u = currentUser();
    setUser(u);
    if (!u) {
      window.location.href = '/entrar';
      return;
    }
    api<{ phone?: string | null }>('/me').then((me) => setPhone(me.phone || '')).catch(() => {});
    api<Address[]>('/me/addresses').then(setAddresses).catch((e) => setErr(e.message));
    api<Loyalty>('/me/loyalty').then(setLoyalty).catch(() => {});
    api<CustomerOrder[]>('/orders')
      .then(setOrders)
      .catch(() => setOrders([]));
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

  const activeOrder = orders ? pickInProgressOrder(orders) : null;
  const activePaths = activeOrder ? orderRecoveryPaths(activeOrder.publicId) : null;
  const activePay = activeOrder?.payments?.find((p) => p.status === 'approved')
    || activeOrder?.payments?.find((p) => p.status === 'pending');

  return (
    <div style={{ padding: '24px 0' }}>
      <div className="row">
        <h1>Minha conta</h1>
        <button className="btn ghost" onClick={() => { clearSession(); window.location.href = '/'; }}>Sair</button>
      </div>
      {user ? <p className="muted">{user.name?.trim() || user.email || 'Conta'} · {user.email} · {user.role}</p> : null}
      {err ? <div className="alert">{err}</div> : null}
      {msg ? <div className="ok">{msg}</div> : null}
      <nav className="account-nav" aria-label="Atalhos da conta">
        <Link href="/pedidos">Meus pedidos</Link>
        <Link href="/notificacoes">Notificações</Link>
        <Link href="/favoritos">Favoritos</Link>
        <Link href="/carrinho">Sacola</Link>
        {user?.role === 'admin' ? <Link href="/admin">Admin da loja</Link> : null}
        {user?.role === 'seller' || user?.role === 'admin' ? <Link href="/vendedor">Portal do vendedor</Link> : null}
      </nav>

      <section className="card" style={{ marginBottom: 24 }} aria-labelledby="conta-pedido-andamento">
        <div className="body">
          <h2 id="conta-pedido-andamento" style={{ marginTop: 0, fontSize: 20 }}>
            Pedido em andamento
          </h2>
          {orders === null ? (
            <p className="muted" style={{ marginBottom: 0 }}>Carregando pedidos...</p>
          ) : activeOrder && activePaths ? (
            <>
              <p style={{ margin: '8px 0 4px' }}>
                Código: <b>{activeOrder.publicId}</b>
              </p>
              <p className="muted" style={{ margin: 0, fontSize: 14 }}>
                {orderStatusLabel(activeOrder.status)}
                {activePay?.method === 'pix' && activePay.status === 'approved'
                  ? ' · PIX aprovado'
                  : activePay?.method === 'pix' && activePay.status === 'pending'
                    ? ' · Aguardando PIX'
                    : ''}
                {' · '}
                {brl(activeOrder.total)}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                <Link className="btn" href={activePaths.verMeuPedido} style={{ minHeight: 44 }}>
                  Acompanhar
                </Link>
                <Link className="btn ghost" href={activePaths.meusPedidos} style={{ minHeight: 44 }}>
                  Meus pedidos
                </Link>
              </div>
            </>
          ) : (
            <div>
              <p className="muted" style={{ margin: '8px 0 12px' }}>
                Nenhum pedido em andamento no momento.
              </p>
              <Link className="btn ghost" href="/pedidos" style={{ minHeight: 44 }}>
                Meus pedidos
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="card loyalty-card" style={{ marginBottom: 24 }}>
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
                      <span style={{ color: r.kind === 'earn' || r.kind === 'refund' ? 'var(--ok)' : undefined }}>
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

      <section className="card" style={{ marginBottom: 24 }}>
        <div className="body">
          <h2 style={{ marginTop: 0, fontSize: 20 }}>WhatsApp</h2>
          <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
            Usamos este número para a loja te avisar sobre pagamento e entrega (abre o WhatsApp com a mensagem pronta).
          </p>
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              setSavingPhone(true);
              setErr('');
              setMsg('');
              try {
                await api('/me', { method: 'PATCH', body: JSON.stringify({ phone: phone.trim() || null }) });
                setMsg('WhatsApp salvo.');
              } catch (e: any) {
                setErr(e.message);
              } finally {
                setSavingPhone(false);
              }
            }}
          >
            <input
              type="tel"
              placeholder="(51) 99625-3766"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <button className="btn ghost" type="submit" disabled={savingPhone}>
              {savingPhone ? 'Salvando...' : 'Salvar WhatsApp'}
            </button>
          </form>
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
