'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  emptySupplierForm,
  marginLabel,
  supplierFormToBody,
  supplierToForm,
  type SupplierForm,
  type SupplierView,
} from '@/lib/admin-supplier-ui';

type Payload = { supplier: SupplierView | null; grossMarginPct: number | null };

/** Fornecedor e custo (interno). GET/PUT /admin/products/:id/supplier — auditado; nunca aparece na loja. */
export function AdminProductSupplierPanel({ productId }: { productId: string }) {
  const [form, setForm] = useState<SupplierForm>(emptySupplierForm());
  const [data, setData] = useState<Payload | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    setState('loading');
    setMsg('');
    setErr('');
    api<Payload>(`/admin/products/${productId}/supplier`)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setForm(supplierToForm(d.supplier));
        setState('ready');
      })
      .catch((e: Error) => {
        if (!alive) return;
        setErr(e.message || 'Falha ao carregar fornecedor.');
        setState('error');
      });
    return () => {
      alive = false;
    };
  }, [productId]);

  async function save() {
    setMsg('');
    setErr('');
    const r = supplierFormToBody(form);
    if ('error' in r) {
      setErr(r.error);
      return;
    }
    setSaving(true);
    try {
      const d = await api<Payload>(`/admin/products/${productId}/supplier`, { method: 'PUT', body: JSON.stringify(r.body) });
      setData(d);
      setForm(supplierToForm(d.supplier));
      setMsg('Fornecedor salvo (registrado na auditoria).');
    } catch (e) {
      setErr((e as Error).message || 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  const set = (k: keyof SupplierForm) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  return (
    <section className="admin-card-pro admin-supplier-panel" id="admin-product-supplier" aria-labelledby="admin-supplier-title">
      <div className="body">
        <p className="admin-ent-kicker">Interno · não aparece na loja</p>
        <h3 id="admin-supplier-title">Fornecedor e custo</h3>
        {state === 'loading' ? <p role="status">Carregando fornecedor…</p> : null}
        {state === 'error' ? <p className="err" role="alert">{err}</p> : null}
        {state === 'ready' ? (
          <>
            <p className="muted">
              {data?.supplier
                ? `${marginLabel(data.grossMarginPct)} · atualizado às ${new Date(data.supplier.updatedAt).toLocaleString('pt-BR')}`
                : 'Não configurado: nenhum fornecedor cadastrado para este produto.'}
            </p>
            <div className="row" style={{ alignItems: 'stretch', flexWrap: 'wrap' }}>
              <label style={{ flex: '1 1 220px' }}>
                Fornecedor *
                <input value={form.supplierName} onChange={set('supplierName')} maxLength={160} />
              </label>
              <label style={{ flex: '1 1 140px' }}>
                Código no fornecedor
                <input value={form.supplierSku} onChange={set('supplierSku')} maxLength={80} />
              </label>
            </div>
            <div className="row" style={{ alignItems: 'stretch', flexWrap: 'wrap' }}>
              <label style={{ flex: '1 1 120px' }}>
                Custo (R$)
                <input inputMode="decimal" value={form.costPrice} onChange={set('costPrice')} />
              </label>
              <label style={{ flex: '1 1 120px' }}>
                Prazo do fornecedor (dias)
                <input inputMode="numeric" value={form.leadTimeDays} onChange={set('leadTimeDays')} />
              </label>
            </div>
            <label>
              Link do produto no fornecedor
              <input type="url" value={form.supplierUrl} onChange={set('supplierUrl')} maxLength={500} />
            </label>
            <label>
              Observações
              <textarea rows={2} value={form.notes} onChange={set('notes')} maxLength={1000} />
            </label>
            {err ? <p className="err" role="alert">{err}</p> : null}
            {msg ? <p className="ok" role="status">{msg}</p> : null}
            <button type="button" className="btn" onClick={() => void save()} disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar fornecedor'}
            </button>
          </>
        ) : null}
      </div>
    </section>
  );
}
