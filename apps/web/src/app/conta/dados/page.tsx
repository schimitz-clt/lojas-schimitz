'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, brl } from '@/lib/api';
import { useSessionUser } from '@/lib/use-session-user';
import {
  ACCOUNT_DADOS_PATH,
  ACCOUNT_EDIT_ADDRESS_CTA,
  ACCOUNT_HUB_TITLE,
  accountAddressFormFrom,
  accountAddressFormOpen,
  accountAddressSaveRequest,
  accountAddressToEdit,
  accountLoginHref,
  emptyAccountAddressForm,
} from '@/lib/account-menu';

type Address = {
  id: string;
  label: string;
  street: string;
  number: string;
  district?: string;
  city: string;
  uf: string;
  cep: string;
  isDefault: boolean;
};
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

export default function ContaDadosPage() {
  const { user, ready } = useSessionUser();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressesLoaded, setAddressesLoaded] = useState(false);
  const [editAddressOpen, setEditAddressOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loyalty, setLoyalty] = useState<Loyalty | null>(null);
  const [form, setForm] = useState(emptyAccountAddressForm);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [phone, setPhone] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);
  const showAddressForm = accountAddressFormOpen({
    loaded: addressesLoaded,
    addressCount: addresses.length,
    userRequestedEdit: editAddressOpen,
  });

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      window.location.href = accountLoginHref(ACCOUNT_DADOS_PATH);
      return;
    }
    api<{ phone?: string | null }>('/me')
      .then((me) => setPhone(me.phone || ''))
      .catch(() => {});
    api<Address[]>('/me/addresses')
      .then(setAddresses)
      .catch((e: { message?: string }) => setErr(e.message || 'Falha ao carregar endereços'))
      .finally(() => setAddressesLoaded(true));
    api<Loyalty>('/me/loyalty')
      .then(setLoyalty)
      .catch(() => {});
  }, [ready, user]);

  function openEditAddress() {
    const current = accountAddressToEdit(addresses);
    setEditingId(current?.id || null);
    setForm(accountAddressFormFrom(current));
    setEditAddressOpen(true);
  }

  async function saveAddress(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    const req = accountAddressSaveRequest(editingId);
    try {
      await api(req.path, { method: req.method, body: JSON.stringify(form) });
      setMsg(req.method === 'PATCH' ? 'Endereço atualizado.' : 'Endereço salvo.');
      const list = await api<Address[]>('/me/addresses');
      setAddresses(list);
      setEditAddressOpen(false);
      setEditingId(null);
      setForm(emptyAccountAddressForm());
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Falha ao salvar endereço');
    }
  }

  return (
    <div className="account-hub account-dados">
      <p className="account-hub-back">
        <Link href="/conta">← {ACCOUNT_HUB_TITLE}</Link>
      </p>
      <header className="account-hub-head">
        <h1 className="account-hub-title">Dados pessoais</h1>
        {user ? (
          <p className="account-hub-sub muted">
            {user.name?.trim() || user.email || 'Conta'} · {user.email}
          </p>
        ) : null}
      </header>
      {err ? <div className="alert">{err}</div> : null}
      {msg ? <div className="ok">{msg}</div> : null}

      <section className="card loyalty-card" style={{ marginBottom: 24 }}>
        <div className="body">
          <h2 style={{ marginTop: 0, fontSize: 20 }}>SCHIMITZ+</h2>
          {loyalty ? (
            <>
              <p style={{ fontSize: 28, margin: '8px 0' }}>
                <b>{brl(loyalty.balance)}</b>
              </p>
              <p className="muted" style={{ marginTop: 0 }}>
                Cashback de {(loyalty.rate * 100).toFixed(0)}% em cada pedido pago. Use no checkout
                (parcial OK).
              </p>
              {loyalty.recent?.length ? (
                <div style={{ marginTop: 12 }}>
                  <h3 style={{ fontSize: 16, marginBottom: 8 }}>Extrato recente</h3>
                  {loyalty.recent.slice(0, 8).map((r) => (
                    <div key={r.id} className="row" style={{ fontSize: 14, marginBottom: 6 }}>
                      <span className="muted">{kindLabel[r.kind] || r.kind}</span>
                      <span
                        style={{
                          color: r.kind === 'earn' || r.kind === 'refund' ? 'var(--ok)' : undefined,
                        }}
                      >
                        {r.kind === 'redeem' ? '−' : '+'}
                        {brl(r.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted" style={{ marginBottom: 0 }}>
                  Ainda sem movimentos. Pague um pedido para começar a acumular.
                </p>
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
            Usamos este número para a loja te avisar sobre pagamento e entrega (abre o WhatsApp com
            a mensagem pronta).
          </p>
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              setSavingPhone(true);
              setErr('');
              setMsg('');
              try {
                await api('/me', {
                  method: 'PATCH',
                  body: JSON.stringify({ phone: phone.trim() || null }),
                });
                setMsg('WhatsApp salvo.');
              } catch (e: unknown) {
                setErr(e instanceof Error ? e.message : 'Falha ao salvar WhatsApp');
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

      <h2 style={{ fontSize: 18 }}>Endereços</h2>
      {addresses.map((a) => (
        <div key={a.id} className="card" style={{ marginBottom: 8 }}>
          <div className="body">
            {a.label}: {a.street}, {a.number} — {a.city}/{a.uf} · CEP {a.cep}
          </div>
        </div>
      ))}
      {showAddressForm ? (
        <form className="form account-dados-address-form" onSubmit={saveAddress}>
          <input
            placeholder="CEP"
            value={form.cep}
            onChange={(e) => setForm({ ...form, cep: e.target.value })}
            required
          />
          <input
            placeholder="Rua"
            value={form.street}
            onChange={(e) => setForm({ ...form, street: e.target.value })}
            required
          />
          <input
            placeholder="Número"
            value={form.number}
            onChange={(e) => setForm({ ...form, number: e.target.value })}
            required
          />
          <input
            placeholder="Bairro"
            value={form.district}
            onChange={(e) => setForm({ ...form, district: e.target.value })}
            required
          />
          <input
            placeholder="Cidade"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            required
          />
          <input
            placeholder="UF"
            maxLength={2}
            value={form.uf}
            onChange={(e) => setForm({ ...form, uf: e.target.value })}
            required
          />
          <button className="btn ghost" type="submit">
            Salvar endereço
          </button>
        </form>
      ) : addressesLoaded && addresses.length > 0 ? (
        <button
          className="btn ghost account-dados-edit-address"
          type="button"
          onClick={openEditAddress}
        >
          {ACCOUNT_EDIT_ADDRESS_CTA}
        </button>
      ) : null}
      <p style={{ marginTop: 16 }}>
        <Link className="btn" href="/checkout">
          Ir ao checkout
        </Link>
      </p>
    </div>
  );
}
