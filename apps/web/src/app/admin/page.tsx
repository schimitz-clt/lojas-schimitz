'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, apiUpload, brl, currentUser } from '@/lib/api';
import { nextFulfillmentStatus, orderStatusLabel } from '@/lib/order-status';

type AdminOrder = {
  id: string;
  publicId: string;
  status: string;
  total: number;
  items?: { name: string; qty: number }[];
};

type Category = { id: string; name: string; slug: string };

type AdminProduct = {
  id: string;
  sku: string;
  name: string;
  slug: string;
  description: string;
  price: string | number;
  compareAtPrice?: string | number | null;
  active: boolean;
  badge?: string | null;
  categoryId?: string | null;
  category?: Category | null;
  inventory?: { qtyOnHand: number; qtyReserved: number } | null;
  images?: { url: string }[];
};

type ProductForm = {
  name: string;
  description: string;
  price: string;
  compareAtPrice: string;
  sku: string;
  stock: string;
  categoryId: string;
  active: boolean;
  imageUrl: string;
  badge: string;
};

const emptyForm = (): ProductForm => ({
  name: '',
  description: '',
  price: '',
  compareAtPrice: '',
  sku: '',
  stock: '0',
  categoryId: '',
  active: true,
  imageUrl: '',
  badge: '',
});

function availableStock(p: AdminProduct) {
  const onHand = p.inventory?.qtyOnHand ?? 0;
  const reserved = p.inventory?.qtyReserved ?? 0;
  return Math.max(0, onHand - reserved);
}

export default function AdminPage() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);

  const load = useCallback(() => {
    const u = currentUser();
    if (!u || u.role !== 'admin') {
      setErr('Acesso restrito a admin. Entre com a conta administrativa.');
      return Promise.resolve();
    }
    return Promise.all([
      api<AdminProduct[]>('/admin/products'),
      api<AdminOrder[]>('/admin/orders'),
      api<Category[]>('/admin/categories'),
    ])
      .then(([p, o, c]) => {
        setProducts(p);
        setOrders(o);
        setCategories(c);
        setErr('');
      })
      .catch((e) => setErr(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const editingLabel = useMemo(
    () => (editingId ? 'Editar produto' : 'Cadastrar produto'),
    [editingId],
  );

  function startEdit(p: AdminProduct) {
    setEditingId(p.id);
    setMsg('');
    setErr('');
    setForm({
      name: p.name,
      description: p.description || '',
      price: String(p.price ?? ''),
      compareAtPrice: p.compareAtPrice != null && p.compareAtPrice !== '' ? String(p.compareAtPrice) : '',
      sku: p.sku,
      stock: String(p.inventory?.qtyOnHand ?? 0),
      categoryId: p.categoryId || p.category?.id || '',
      active: !!p.active,
      imageUrl: p.images?.[0]?.url || '',
      badge: p.badge || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm());
    setMsg('');
  }


  async function uploadPhoto(file: File | null) {
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setErr('Use uma imagem JPG, PNG ou WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErr('A foto deve ter no máximo 5 MB.');
      return;
    }
    setUploading(true);
    setErr('');
    setMsg('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const data = await apiUpload<{ url: string }>('/admin/uploads', fd);
      setForm((f) => ({ ...f, imageUrl: data.url }));
      setMsg('Foto enviada. Salve o produto para publicar.');
    } catch (e: any) {
      setErr(e.message || 'Falha ao enviar foto');
    } finally {
      setUploading(false);
    }
  }

  async function saveProduct(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr('');
    setMsg('');
    const price = Number(String(form.price).replace(',', '.'));
    const stock = Number.parseInt(form.stock, 10);
    const compareRaw = form.compareAtPrice.trim();
    const compareAtPrice = compareRaw === '' ? null : Number(compareRaw.replace(',', '.'));
    if (!form.name.trim() || Number.isNaN(price) || price < 0) {
      setErr('Informe nome e um preço válido.');
      setSaving(false);
      return;
    }
    if (Number.isNaN(stock) || stock < 0) {
      setErr('Estoque deve ser um número inteiro ≥ 0.');
      setSaving(false);
      return;
    }
    if (compareAtPrice != null && (Number.isNaN(compareAtPrice) || compareAtPrice < 0)) {
      setErr('Preço “de” (riscado) inválido.');
      setSaving(false);
      return;
    }

    const body: Record<string, unknown> = {
      name: form.name.trim(),
      description: form.description.trim(),
      price,
      stock,
      active: form.active,
      categoryId: form.categoryId || null,
      badge: form.badge.trim() || null,
      compareAtPrice,
      imageUrl: form.imageUrl.trim() || null,
    };
    if (form.sku.trim()) body.sku = form.sku.trim();

    try {
      if (editingId) {
        await api(`/admin/products/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        setMsg('Produto atualizado.');
      } else {
        await api('/admin/products', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        setMsg('Produto cadastrado e já disponível na loja (se ativo).');
      }
      resetForm();
      await load();
    } catch (e: any) {
      setErr(e.message || 'Falha ao salvar produto');
    } finally {
      setSaving(false);
    }
  }

  async function advance(order: AdminOrder) {
    const next = nextFulfillmentStatus(order.status);
    if (!next) return;
    setBusyId(order.id);
    setErr('');
    try {
      await api(`/admin/orders/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });
      await load();
    } catch (e: any) {
      setErr(e.message || 'Falha ao atualizar status');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ padding: '24px 0' }}>
      <h1>Admin Schimitz</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Cadastre produtos, ajuste estoque e avance a entrega dos pedidos. Sem termos técnicos.
      </p>
      {err ? <div className="alert">{err}</div> : null}
      {msg ? <div className="ok">{msg}</div> : null}

      <section className="card" style={{ marginTop: 16, marginBottom: 28 }}>
        <div className="body">
          <div className="row" style={{ marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>{editingLabel}</h2>
            {editingId ? (
              <button type="button" className="btn ghost" onClick={resetForm}>
                Cancelar edição
              </button>
            ) : null}
          </div>
          <form className="form" style={{ maxWidth: 560 }} onSubmit={saveProduct}>
            <label>
              Nome do produto *
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex.: Smart TV 55&quot; 4K"
                required
              />
            </label>
            <label>
              Descrição
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="O que o cliente precisa saber"
              />
            </label>
            <div className="row" style={{ alignItems: 'stretch' }}>
              <label style={{ flex: 1 }}>
                Preço (R$) *
                <input
                  inputMode="decimal"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="199,90"
                  required
                />
              </label>
              <label style={{ flex: 1 }}>
                Preço “de” (opcional)
                <input
                  inputMode="decimal"
                  value={form.compareAtPrice}
                  onChange={(e) => setForm({ ...form, compareAtPrice: e.target.value })}
                  placeholder="249,90"
                />
              </label>
            </div>
            <div className="row" style={{ alignItems: 'stretch' }}>
              <label style={{ flex: 1 }}>
                Estoque *
                <input
                  inputMode="numeric"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  required
                />
              </label>
              <label style={{ flex: 1 }}>
                Código SKU
                <input
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  placeholder="Deixe em branco para gerar"
                />
              </label>
            </div>
            <label>
              Categoria
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              >
                <option value="">Sem categoria</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Foto do produto</div>
              <div className="row" style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <label className="btn ghost" style={{ cursor: uploading ? 'wait' : 'pointer', margin: 0 }}>
                  {uploading ? 'Enviando...' : 'Enviar foto'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={uploading || saving}
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      e.target.value = '';
                      void uploadPhoto(f);
                    }}
                  />
                </label>
                {form.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={form.imageUrl}
                    alt="Prévia"
                    style={{
                      width: 64,
                      height: 64,
                      objectFit: 'cover',
                      borderRadius: 8,
                      background: '#111',
                    }}
                  />
                ) : null}
              </div>
              <p className="muted" style={{ margin: '8px 0 0', fontSize: 13 }}>
                JPG, PNG ou WebP · até 5 MB. Você também pode colar um link abaixo.
              </p>
            </div>
            <label>
              URL da imagem (opcional)
              <input
                value={form.imageUrl}
                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                placeholder="https://... ou envie uma foto acima"
              />
            </label>
            <label>
              Selo / destaque (opcional)
              <input
                value={form.badge}
                onChange={(e) => setForm({ ...form, badge: e.target.value })}
                placeholder="Ex.: Oferta, Mais vendido"
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: 'row' }}>
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Produto ativo (aparece na loja)
            </label>
            <button className="btn" type="submit" disabled={saving}>
              {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Cadastrar produto'}
            </button>
          </form>
        </div>
      </section>

      <h3>Produtos ({products.length})</h3>
      <div style={{ display: 'grid', gap: 10, marginBottom: 28 }}>
        {products.map((p) => {
          const avail = availableStock(p);
          return (
            <div key={p.id} className="card">
              <div className="body row" style={{ alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: 12, flex: 1, minWidth: 0 }}>
                  {p.images?.[0]?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.images[0].url}
                      alt=""
                      style={{
                        width: 56,
                        height: 56,
                        objectFit: 'cover',
                        borderRadius: 8,
                        background: '#111',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 8,
                        background: 'var(--bg)',
                        border: '1px solid var(--line)',
                      }}
                    />
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div>
                      <b>{p.name}</b>{' '}
                      {!p.active ? <span className="badge">Inativo</span> : null}
                    </div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {p.sku} · {brl(p.price)}
                      {p.category ? ` · ${p.category.name}` : ''}
                    </div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      Estoque: {p.inventory?.qtyOnHand ?? 0}
                      {(p.inventory?.qtyReserved ?? 0) > 0
                        ? ` (${avail} disponível, ${p.inventory?.qtyReserved} reservado)`
                        : null}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn ghost" onClick={() => startEdit(p)}>
                    Editar
                  </button>
                  {p.active ? (
                    <Link className="btn ghost" href={`/produto/${p.slug}`} target="_blank">
                      Ver na loja
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
        {!products.length ? <p className="muted">Nenhum produto ainda. Cadastre o primeiro acima.</p> : null}
      </div>

      <h3>Pedidos ({orders.length})</h3>
      <p className="muted" style={{ fontSize: 14 }}>
        Entrega própria: avance Separando → Saiu para entrega → Entregue (sem Melhor Envio).
      </p>
      {orders.map((o) => {
        const next = nextFulfillmentStatus(o.status);
        return (
          <div key={o.id} className="card" style={{ marginBottom: 10 }}>
            <div className="body row">
              <div>
                <b>{o.publicId}</b>
                <div className="muted">
                  {orderStatusLabel(o.status)} <span style={{ opacity: 0.6 }}>({o.status})</span>
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {brl(o.total)}
                  {o.items?.length ? ` · ${o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}` : ''}
                </div>
              </div>
              {next ? (
                <button
                  className="btn"
                  disabled={busyId === o.id}
                  onClick={() => advance(o)}
                  title={`Avançar para ${orderStatusLabel(next)}`}
                >
                  {busyId === o.id ? 'Salvando...' : `Marcar: ${orderStatusLabel(next)}`}
                </button>
              ) : (
                <span className="badge">{orderStatusLabel(o.status)}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
