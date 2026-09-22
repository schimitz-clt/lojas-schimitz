'use client';

import { useState } from 'react';
import { api, brl } from '@/lib/api';
import { useAdminConsole } from '@/components/admin/admin-console-context';
import {
  CATALOG_IMPORT_TEMPLATE,
  batchSelectionError,
  catalogImportFileError,
  toggleSkuSelection,
} from '@/lib/catalog-import-ui';

type ImportReport = {
  applied: boolean;
  created: number;
  updated: number;
  failed: number;
  errors: { line: number; sku?: string; message: string }[];
  errorsTruncated: boolean;
  fileError: string | null;
  deleted: number;
};

type BatchReport = {
  updated: number;
  failed: number;
  errors: { sku: string; message: string }[];
  errorsTruncated: boolean;
  deleted: number;
};

type SearchItem = {
  id: string;
  sku: string;
  name: string;
  price: number | string;
  active: boolean;
  inventory?: { qtyOnHand: number } | null;
};

type SearchPage = {
  items: SearchItem[];
  total: number;
  page: number;
  pageSize: number;
};

export function AdminCatalogImportPanel() {
  const { load } = useAdminConsole();
  const [csvText, setCsvText] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [importErr, setImportErr] = useState('');

  const [q, setQ] = useState('');
  const [active, setActive] = useState<'all' | 'true' | 'false'>('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState<SearchPage | null>(null);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchErr, setSearchErr] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchReport, setBatchReport] = useState<BatchReport | null>(null);
  const [priceMode, setPriceMode] = useState<'set' | 'percent'>('set');
  const [priceValue, setPriceValue] = useState('');
  const [stockMode, setStockMode] = useState<'set' | 'delta'>('set');
  const [stockValue, setStockValue] = useState('');

  async function onFile(file: File | null) {
    setImportErr('');
    setImportReport(null);
    if (!file) return;
    const text = await file.text();
    const problem = catalogImportFileError(text);
    if (problem) {
      setImportErr(problem);
      setCsvText('');
      return;
    }
    setCsvText(text);
  }

  async function submitImport() {
    const problem = catalogImportFileError(csvText);
    if (problem) {
      setImportErr(problem);
      return;
    }
    if (
      !window.confirm(
        'Importar este CSV? Produtos existentes são atualizados pelo SKU. Linhas inválidas são ignoradas. Nenhum produto é apagado.',
      )
    ) {
      return;
    }
    setImportBusy(true);
    setImportErr('');
    setImportReport(null);
    try {
      const report = await api<ImportReport>('/admin/products/import', {
        method: 'POST',
        body: JSON.stringify({ csv: csvText }),
      });
      setImportReport(report);
      if (report.created + report.updated > 0) await load();
    } catch (e) {
      setImportErr(e instanceof Error ? e.message : 'Falha na importação. Nada foi confirmado.');
    } finally {
      setImportBusy(false);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([CATALOG_IMPORT_TEMPLATE], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'modelo-importacao-catalogo.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function runSearch(nextPage = 1, opts?: { keepReport?: boolean }) {
    setSearchBusy(true);
    setSearchErr('');
    if (!opts?.keepReport) setBatchReport(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      params.set('page', String(nextPage));
      params.set('pageSize', '20');
      if (active !== 'all') params.set('active', active);
      const data = await api<SearchPage>(`/admin/products?${params.toString()}`);
      setSearch(data);
      setPage(data.page || nextPage);
      setSelected([]);
    } catch (e) {
      setSearchErr(e instanceof Error ? e.message : 'Falha na busca.');
    } finally {
      setSearchBusy(false);
    }
  }

  async function runBatch(body: Record<string, unknown>, confirmText: string) {
    const problem = batchSelectionError(selected.length);
    if (problem) {
      setSearchErr(problem);
      return;
    }
    if (!window.confirm(confirmText)) return;
    setBatchBusy(true);
    setSearchErr('');
    setBatchReport(null);
    try {
      const report = await api<BatchReport>('/admin/products/batch', {
        method: 'POST',
        body: JSON.stringify({ skus: selected, ...body }),
      });
      setBatchReport(report);
      if (report.updated > 0) {
        await load();
        await runSearch(page, { keepReport: true });
      }
    } catch (e) {
      setSearchErr(e instanceof Error ? e.message : 'Falha no lote. Nada foi confirmado.');
    } finally {
      setBatchBusy(false);
    }
  }

  function parseMoneyInput(raw: string): number | null {
    let s = raw.trim().replace(/\s/g, '').replace(/^R\$/i, '');
    if (!s) return null;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 100) / 100;
  }

  const pages = search ? Math.max(1, Math.ceil(search.total / (search.pageSize || 20))) : 1;

  return (
    <section id="admin-import-lote" className="admin-card-pro admin-catalog-panel" aria-labelledby="admin-import-title">
      <div className="body">
        <h2 id="admin-import-title">Importação / Lote</h2>
        <p className="muted admin-import-help">
          Painel separado do formulário de produto. O CSV cria ou atualiza pelo SKU (preço, estoque, ativo).
          Células vazias não apagam o que já está salvo. Fotos só entram se a planilha trouxer URL real —
          placeholder é recusado e nenhuma foto existente é removida. Máximo de 500 linhas por envio.
          O catálogo de produção não é preenchido por este painel sozinho.
        </p>

        <div className="admin-import-actions">
          <button type="button" className="btn ghost admin-btn-ghost-pro" onClick={downloadTemplate}>
            Baixar modelo (só cabeçalho)
          </button>
          <label className="btn ghost admin-btn-ghost-pro" style={{ cursor: 'pointer' }}>
            Escolher CSV
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              style={{ display: 'none' }}
              onChange={(e) => {
                void onFile(e.target.files?.[0] || null);
                e.target.value = '';
              }}
            />
          </label>
          <button type="button" className="btn" disabled={importBusy || !csvText.trim()} onClick={() => void submitImport()}>
            {importBusy ? 'Importando…' : 'Importar CSV'}
          </button>
        </div>
        <label>
          Ou cole o CSV
          <textarea
            rows={6}
            value={csvText}
            onChange={(e) => {
              setCsvText(e.target.value);
              setImportErr('');
            }}
            placeholder="sku;nome;preco;estoque;ativo"
            spellCheck={false}
          />
        </label>
        {importErr ? (
          <p role="alert" className="alert admin-catalog-alert--danger">
            {importErr}
          </p>
        ) : null}
        {importReport ? (
          <div className="admin-import-report" role="status">
            {importReport.fileError ? <p>{importReport.fileError}</p> : null}
            <p>
              Criados: {importReport.created} · Atualizados: {importReport.updated} · Erros:{' '}
              {importReport.failed} · Apagados: {importReport.deleted}
            </p>
            {importReport.errors.length ? (
              <ul className="admin-import-errors">
                {importReport.errors.map((err, i) => (
                  <li key={`${err.line}-${err.sku || i}`}>
                    Linha {err.line}
                    {err.sku ? ` · ${err.sku}` : ''}: {err.message}
                  </li>
                ))}
              </ul>
            ) : null}
            {importReport.errorsTruncated ? <p>Lista de erros truncada.</p> : null}
          </div>
        ) : null}

        <h3 style={{ marginTop: 18 }}>Busca e ajuste em lote</h3>
        <p className="muted admin-import-help">
          Busca por SKU ou nome. A ação vale só para os SKUs marcados nesta página. O restante do catálogo não muda.
        </p>
        <div className="row" style={{ alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          <label style={{ flex: 1, minWidth: 180 }}>
            SKU ou nome
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="FICT-001 ou nome" />
          </label>
          <label style={{ minWidth: 140 }}>
            Situação
            <select value={active} onChange={(e) => setActive(e.target.value as 'all' | 'true' | 'false')}>
              <option value="all">Todos</option>
              <option value="true">Ativos</option>
              <option value="false">Inativos</option>
            </select>
          </label>
          <button type="button" className="btn" disabled={searchBusy} onClick={() => void runSearch(1)}>
            {searchBusy ? 'Buscando…' : 'Buscar'}
          </button>
        </div>
        {searchErr ? (
          <p role="alert" className="alert admin-catalog-alert--danger">
            {searchErr}
          </p>
        ) : null}
        {search ? (
          <>
            <p className="muted" style={{ fontSize: 13 }}>
              {search.total} produto(s) · página {page} de {pages}
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-import-table">
                <thead>
                  <tr>
                    <th>Marcar</th>
                    <th>SKU</th>
                    <th>Nome</th>
                    <th>Preço</th>
                    <th>Estoque</th>
                    <th>Ativo</th>
                  </tr>
                </thead>
                <tbody>
                  {search.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.includes(item.sku)}
                          aria-label={`Marcar ${item.sku}`}
                          onChange={() => setSelected((prev) => toggleSkuSelection(prev, item.sku))}
                        />
                      </td>
                      <td>{item.sku}</td>
                      <td>{item.name}</td>
                      <td>{brl(item.price)}</td>
                      <td>{item.inventory?.qtyOnHand ?? 0}</td>
                      <td>{item.active ? 'Sim' : 'Não'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!search.items.length ? <p className="muted">Nenhum produto nesta busca.</p> : null}
            <div className="admin-import-actions">
              <button type="button" className="btn ghost" disabled={page <= 1 || searchBusy} onClick={() => void runSearch(page - 1)}>
                Anterior
              </button>
              <button
                type="button"
                className="btn ghost"
                disabled={page >= pages || searchBusy}
                onClick={() => void runSearch(page + 1)}
              >
                Próxima
              </button>
              <button
                type="button"
                className="btn ghost"
                disabled={batchBusy}
                onClick={() =>
                  void runBatch(
                    { active: true },
                    `Ativar ${selected.length} SKU(s) marcado(s)? Os demais não mudam.`,
                  )
                }
              >
                Ativar marcados
              </button>
              <button
                type="button"
                className="btn ghost"
                disabled={batchBusy}
                onClick={() =>
                  void runBatch(
                    { active: false },
                    `Desativar ${selected.length} SKU(s) marcado(s)? Os demais não mudam.`,
                  )
                }
              >
                Desativar marcados
              </button>
            </div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label>
                Preço
                <select value={priceMode} onChange={(e) => setPriceMode(e.target.value as 'set' | 'percent')}>
                  <option value="set">Definir (R$)</option>
                  <option value="percent">Ajustar (%)</option>
                </select>
              </label>
              <label>
                Valor
                <input value={priceValue} onChange={(e) => setPriceValue(e.target.value)} inputMode="decimal" placeholder="10 ou -5" />
              </label>
              <button
                type="button"
                className="btn ghost"
                disabled={batchBusy}
                onClick={() => {
                  const value = parseMoneyInput(priceValue);
                  if (value == null) {
                    setSearchErr('Valor de preço inválido.');
                    return;
                  }
                  void runBatch(
                    { priceMode, priceValue: value },
                    `Ajustar preço de ${selected.length} SKU(s)? Os demais não mudam.`,
                  );
                }}
              >
                Aplicar preço
              </button>
              <label>
                Estoque
                <select value={stockMode} onChange={(e) => setStockMode(e.target.value as 'set' | 'delta')}>
                  <option value="set">Definir</option>
                  <option value="delta">Somar/subtrair</option>
                </select>
              </label>
              <label>
                Quantidade
                <input value={stockValue} onChange={(e) => setStockValue(e.target.value)} inputMode="numeric" placeholder="0" />
              </label>
              <button
                type="button"
                className="btn ghost"
                disabled={batchBusy}
                onClick={() => {
                  const raw = stockValue.trim();
                  const value = Number(raw);
                  if (!raw || !Number.isInteger(value)) {
                    setSearchErr('Estoque inválido (inteiro).');
                    return;
                  }
                  void runBatch(
                    { stockMode, stockValue: value },
                    `Ajustar estoque de ${selected.length} SKU(s)? Reserva existente continua protegida. Os demais não mudam.`,
                  );
                }}
              >
                Aplicar estoque
              </button>
            </div>
            {batchReport ? (
              <div className="admin-import-report" role="status">
                <p>
                  Atualizados: {batchReport.updated} · Erros: {batchReport.failed} · Apagados: {batchReport.deleted}
                </p>
                {batchReport.errors.length ? (
                  <ul className="admin-import-errors">
                    {batchReport.errors.map((err) => (
                      <li key={err.sku}>
                        {err.sku}: {err.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}
