'use client';

import { useState } from 'react';
import { api, brl } from '@/lib/api';
import { matrixToCsv, readSpreadsheetFile } from '@/lib/spreadsheet-read';

type PreviewRow = {
  line: number;
  sku: string;
  productName: string;
  action: 'criar' | 'atualizar' | 'sem mudança';
  before: { supplierName: string; costPrice: number | null } | null;
  after: { supplierName: string; costPrice: number | null; leadTimeDays: number | null };
};
type ImportResult = {
  dryRun: boolean;
  applied: boolean;
  errors: { line: number; sku: string | null; message: string }[];
  errorCount: number;
  summary: { criar: number; atualizar: number; semMudanca: number };
  preview: PreviewRow[];
  written?: number;
};

/** Fornecedor e custo em lote: conferir antes, aplicar tudo ou nada. Registrado na auditoria. */
export function AdminSupplierImportPanel() {
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<ImportResult | null>(null);
  const [err, setErr] = useState('');

  async function downloadTemplate() {
    try {
      const d = await api<{ filename: string; csv: string }>('/admin/suppliers/template');
      const blob = new Blob([`\uFEFF${d.csv}`], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = d.filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setErr((e as Error).message || 'Não foi possível baixar o modelo.');
    }
  }

  async function onFile(f: File | undefined) {
    setErr('');
    setRes(null);
    if (!f) return;
    try {
      setFileName(f.name);
      setCsv(matrixToCsv(await readSpreadsheetFile(f)));
    } catch (e) {
      setErr((e as Error).message || 'Não foi possível ler o arquivo.');
    }
  }

  async function run(dryRun: boolean) {
    setBusy(true);
    setErr('');
    try {
      const d = await api<ImportResult>('/admin/suppliers/import', { method: 'POST', body: JSON.stringify({ csv, dryRun }) });
      setRes(d);
    } catch (e) {
      setErr((e as Error).message || 'Falha na importação.');
    } finally {
      setBusy(false);
    }
  }

  const canApply = !!res && res.dryRun && res.errorCount === 0 && res.summary.criar + res.summary.atualizar > 0;

  return (
    <section className="admin-card-pro" id="admin-supplier-import" aria-labelledby="admin-supplier-import-title">
      <div className="body">
        <p className="admin-ent-kicker">Fornecedores em lote</p>
        <h3 id="admin-supplier-import-title">Importar fornecedor e custo por planilha</h3>
        <p className="muted">
          Colunas: sku, fornecedor, codigo_fornecedor, custo, prazo_dias, link, observacoes. Primeiro confira, depois aplique.
          Se houver qualquer erro, nada é gravado. O custo nunca aparece na loja.
        </p>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <button type="button" className="btn ghost admin-btn-ghost-pro" onClick={() => void downloadTemplate()}>
            Baixar modelo
          </button>
          <label className="btn ghost admin-btn-ghost-pro" style={{ cursor: 'pointer' }}>
            Escolher planilha (.csv ou .xlsx)
            <input type="file" accept=".csv,.xlsx,text/csv" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
          </label>
          {fileName ? <span className="muted">{fileName}</span> : null}
        </div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          <button type="button" className="btn" disabled={!csv || busy} onClick={() => void run(true)}>
            {busy ? 'Conferindo…' : 'Conferir'}
          </button>
          <button type="button" className="btn admin-btn-primary-accent" disabled={!canApply || busy} onClick={() => void run(false)}>
            Aplicar
          </button>
        </div>
        {err ? <p className="err" role="alert">{err}</p> : null}
        {res ? (
          <div role="status" style={{ marginTop: 12 }}>
            <p>
              {res.applied
                ? `Gravado: ${res.written ?? 0} produto(s). Registrado na auditoria.`
                : `Conferência: ${res.summary.criar} novo(s), ${res.summary.atualizar} atualização(ões), ${res.summary.semMudanca} sem mudança, ${res.errorCount} erro(s).`}
            </p>
            {res.errors.length ? (
              <ul className="err">
                {res.errors.map((e) => (
                  <li key={`${e.line}-${e.sku}`}>
                    Linha {e.line}
                    {e.sku ? ` (${e.sku})` : ''}: {e.message}
                  </li>
                ))}
              </ul>
            ) : null}
            {res.preview.length ? (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr><th>SKU</th><th>Produto</th><th>Ação</th><th>Fornecedor</th><th>Custo</th></tr>
                  </thead>
                  <tbody>
                    {res.preview.map((r) => (
                      <tr key={r.line}>
                        <td data-label="SKU">{r.sku}</td>
                        <td data-label="Produto">{r.productName}</td>
                        <td data-label="Ação">{r.action}</td>
                        <td data-label="Fornecedor">
                          {r.before && r.before.supplierName !== r.after.supplierName ? `${r.before.supplierName} → ` : ''}
                          {r.after.supplierName}
                        </td>
                        <td data-label="Custo">{r.after.costPrice == null ? '—' : brl(r.after.costPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
