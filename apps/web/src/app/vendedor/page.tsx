'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, brl, isUnauthorizedError } from '@/lib/api';
import { useSessionUser } from '@/lib/use-session-user';
import { loginNextPath } from '@/lib/order-recovery';
import { orderStatusLabel } from '@/lib/order-status';

type SellerMpStatus = {
  connectEnabled: boolean;
  houseBrand: boolean;
  oauthStatus: string;
  linked: boolean;
  mpUserId: string | null;
};

type SellerMe = {
  id: string;
  name: string;
  slug: string;
  status: string;
  commissionPercent: number | null;
  productCount: number;
  mp?: SellerMpStatus;
};

type SellerProduct = {
  id: string;
  sku: string;
  name: string;
  slug: string;
  price: number;
  stock: number;
  reserved: number;
  active: boolean;
  imageUrl: string | null;
};

type SellerOrder = {
  orderId: string;
  publicId: string;
  status: string;
  orderTotal: number;
  createdAt: string;
  trackingCode: string | null;
  items: { id: string; name: string; qty: number; unitPrice: number }[];
};

type SellerCommissionItem = {
  id: string;
  amount: number;
  percent: number;
  status: string;
  createdAt: string;
  payoutReference?: string | null;
  paidAt?: string | null;
  order?: { publicId: string; status: string };
  orderItem?: { name: string; qty: number; unitPrice: number };
};

type SellerCommissionsPayload = {
  items: SellerCommissionItem[];
  totals: { pending: number; approved: number; paid: number; cancelled: number; all: number };
};

export default function VendedorPage() {
  const { user, ready } = useSessionUser();
  const [me, setMe] = useState<SellerMe | null>(null);
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [commissions, setCommissions] = useState<SellerCommissionsPayload | null>(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [mpBusy, setMpBusy] = useState(false);
  const [edits, setEdits] = useState<Record<string, { price: string; stock: string }>>({});

  const load = useCallback(async () => {
    setErr('');
    try {
      const [seller, prods, ords, coms] = await Promise.all([
        api<SellerMe>('/seller/me'),
        api<SellerProduct[]>('/seller/products'),
        api<SellerOrder[]>('/seller/orders'),
        api<SellerCommissionsPayload>('/seller/commissions'),
      ]);
      setMe(seller);
      setProducts(prods);
      setOrders(ords);
      setCommissions(coms);
      const next: Record<string, { price: string; stock: string }> = {};
      for (const p of prods) {
        next[p.id] = { price: String(p.price), stock: String(p.stock) };
      }
      setEdits(next);
    } catch (e: unknown) {
      if (isUnauthorizedError(e)) {
        window.location.href = loginNextPath('/vendedor');
        return;
      }
      setErr(e instanceof Error ? e.message : 'Falha ao carregar portal do vendedor');
      setMe(null);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      window.location.href = loginNextPath('/vendedor');
      return;
    }
    void load();
  }, [load, ready, user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const flag = new URLSearchParams(window.location.search).get('mp');
    if (flag === 'ok') setMsg('Conta Mercado Pago conectada.');
    if (flag === 'denied') setErr('Conexão Mercado Pago cancelada.');
    if (flag === 'error') setErr('Não foi possível conectar o Mercado Pago. Tente de novo.');
  }, []);

  async function connectMercadoPago() {
    setMpBusy(true);
    setErr('');
    setMsg('');
    try {
      const data = await api<{ authorizationUrl: string }>('/seller/mp/connect');
      if (!data.authorizationUrl) throw new Error('URL de autorização ausente');
      window.location.href = data.authorizationUrl;
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : 'Falha ao iniciar conexão Mercado Pago');
      setMpBusy(false);
    }
  }

  async function saveProduct(e: FormEvent, productId: string) {
    e.preventDefault();
    const edit = edits[productId];
    if (!edit) return;
    const price = Number(String(edit.price).replace(',', '.'));
    const stock = Number(edit.stock);
    if (Number.isNaN(price) || price < 0) {
      setErr('Preço inválido');
      return;
    }
    if (!Number.isInteger(stock) || stock < 0) {
      setErr('Estoque inválido (número inteiro ≥ 0)');
      return;
    }
    setBusyId(productId);
    setErr('');
    setMsg('');
    try {
      await api(`/seller/products/${productId}`, {
        method: 'PATCH',
        body: JSON.stringify({ price, stock }),
      });
      setMsg('Produto atualizado.');
      await load();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : 'Falha ao salvar');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ padding: '24px 0' }}>
      <div className="row" style={{ marginBottom: 8 }}>
        <h1 style={{ margin: 0 }}>Portal do vendedor</h1>
        <Link className="btn ghost" href="/conta">
          Minha conta
        </Link>
      </div>
      {user ? (
        <p className="muted">
          {user.name || user.email} · {user.email}
        </p>
      ) : null}
      {err ? <div className="alert">{err}</div> : null}
      {msg ? <div className="ok">{msg}</div> : null}

      {me ? (
        <section className="card" style={{ marginBottom: 20 }}>
          <div className="body">
            <h2 style={{ marginTop: 0, fontSize: 18 }}>{me.name}</h2>
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>
              /{me.slug} · status <b>{me.status}</b>
              {me.commissionPercent != null ? ` · comissão ${me.commissionPercent}%` : ' · comissão padrão 10%'}
              {` · ${me.productCount} produto(s)`}
            </p>
          </div>
        </section>
      ) : !err ? (
        <p className="muted">Carregando…</p>
      ) : (
        <p className="muted">
          Se você deveria ter acesso, peça ao admin para vincular seu e-mail em{' '}
          <b>Admin → Vendedores</b> (owner).
        </p>
      )}

      {me ? (
        <>
          {me.mp?.connectEnabled ? (
            <section className="card" style={{ marginBottom: 20 }}>
              <div className="body">
                <h2 style={{ marginTop: 0, fontSize: 18 }}>Mercado Pago</h2>
                <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
                  Conecte a conta do vendedor para o split automático (Fase 1 — vínculo só; o
                  pagamento ainda entra no collector da loja). A loja própria não faz self-split.
                </p>
                {me.mp.linked ? (
                  <p style={{ marginBottom: 0 }}>
                    Conta conectada
                    {me.mp.mpUserId ? ` · collector ${me.mp.mpUserId}` : ''}. Status:{' '}
                    <b>{me.mp.oauthStatus}</b>
                  </p>
                ) : (
                  <button
                    className="btn"
                    type="button"
                    disabled={mpBusy}
                    onClick={() => void connectMercadoPago()}
                  >
                    {mpBusy ? '…' : 'Conectar Mercado Pago'}
                  </button>
                )}
                {me.mp.oauthStatus === 'expired' || me.mp.oauthStatus === 'revoked' ? (
                  <p className="muted" style={{ fontSize: 13, marginBottom: 0, marginTop: 8 }}>
                    Vínculo {me.mp.oauthStatus === 'expired' ? 'expirado' : 'revogado'}. Conecte de
                    novo.
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="card" style={{ marginBottom: 20 }}>
            <div className="body">
              <h2 style={{ marginTop: 0, fontSize: 18 }}>Meus produtos</h2>
              <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
                Você só pode alterar preço e estoque dos seus produtos.
              </p>
              <div style={{ display: 'grid', gap: 12 }}>
                {products.map((p) => (
                  <form
                    key={p.id}
                    onSubmit={(e) => void saveProduct(e, p.id)}
                    className="row"
                    style={{
                      flexWrap: 'wrap',
                      gap: 10,
                      padding: 12,
                      borderRadius: 10,
                      border: '1px solid var(--line)',
                      background: 'var(--bg)',
                      alignItems: 'flex-end',
                    }}
                  >
                    <div style={{ flex: 1.5, minWidth: 160 }}>
                      <b>{p.name}</b>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {p.sku}
                        {!p.active ? ' · inativo' : ''}
                        {p.reserved ? ` · reservado ${p.reserved}` : ''}
                      </div>
                    </div>
                    <label style={{ margin: 0, minWidth: 110 }}>
                      Preço (R$)
                      <input
                        value={edits[p.id]?.price ?? ''}
                        onChange={(e) =>
                          setEdits((prev) => ({
                            ...prev,
                            [p.id]: { ...prev[p.id], price: e.target.value, stock: prev[p.id]?.stock ?? '' },
                          }))
                        }
                        required
                      />
                    </label>
                    <label style={{ margin: 0, minWidth: 90 }}>
                      Estoque
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={edits[p.id]?.stock ?? ''}
                        onChange={(e) =>
                          setEdits((prev) => ({
                            ...prev,
                            [p.id]: { ...prev[p.id], stock: e.target.value, price: prev[p.id]?.price ?? '' },
                          }))
                        }
                        required
                      />
                    </label>
                    <button className="btn" type="submit" disabled={busyId === p.id}>
                      {busyId === p.id ? '…' : 'Salvar'}
                    </button>
                  </form>
                ))}
                {!products.length ? (
                  <p className="muted" style={{ margin: 0 }}>
                    Nenhum produto atribuído a você ainda.
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="card" style={{ marginBottom: 20 }}>
            <div className="body">
              <h2 style={{ marginTop: 0, fontSize: 18 }}>Comissões / Repasse (somente leitura)</h2>
              <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
                Valores do ledger. O pagamento (PIX) é feito manualmente pela loja — sem split
                automático do Mercado Pago.
              </p>
              {commissions ? (
                <div className="row" style={{ flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                  <span className="badge">Pendentes {brl(commissions.totals.pending)}</span>
                  <span className="badge">Aprovadas {brl(commissions.totals.approved)}</span>
                  <span className="badge">Pagas {brl(commissions.totals.paid)}</span>
                </div>
              ) : null}
              <div style={{ display: 'grid', gap: 8 }}>
                {(commissions?.items || []).map((c) => (
                  <div
                    key={c.id}
                    className="row"
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      border: '1px solid var(--line)',
                      background: 'var(--bg)',
                      flexWrap: 'wrap',
                      fontSize: 14,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <b>{c.order?.publicId || '—'}</b>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {c.orderItem ? `${c.orderItem.qty}× ${c.orderItem.name}` : ''}
                        {c.payoutReference ? ` · ref ${c.payoutReference}` : ''}
                      </div>
                    </div>
                    <span className="badge">{c.status}</span>
                    <b>{brl(c.amount)}</b>
                    <span className="muted">{c.percent}%</span>
                  </div>
                ))}
                {!commissions?.items?.length ? (
                  <p className="muted" style={{ margin: 0 }}>
                    Nenhuma comissão registrada ainda.
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="card">
            <div className="body">
              <h2 style={{ marginTop: 0, fontSize: 18 }}>Pedidos (somente leitura)</h2>
              <div style={{ display: 'grid', gap: 10 }}>
                {orders.map((o) => (
                  <div
                    key={o.orderId}
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      border: '1px solid var(--line)',
                      background: 'var(--bg)',
                    }}
                  >
                    <div className="row" style={{ flexWrap: 'wrap' }}>
                      <b>{o.publicId}</b>
                      <span className="badge">{orderStatusLabel(o.status)}</span>
                      <span className="muted" style={{ fontSize: 13 }}>
                        {new Date(o.createdAt).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                      {o.items.map((it) => (
                        <li key={it.id} style={{ fontSize: 14 }}>
                          {it.qty}× {it.name} — {brl(it.unitPrice)}
                        </li>
                      ))}
                    </ul>
                    {o.trackingCode ? (
                      <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
                        Rastreio: {o.trackingCode}
                      </p>
                    ) : null}
                  </div>
                ))}
                {!orders.length ? (
                  <p className="muted" style={{ margin: 0 }}>
                    Ainda não há itens seus em pedidos.
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
