'use client';

import { useRef, useState } from 'react';
import { api, apiUpload, brl } from '@/lib/api';
import { useAdminConsole } from '@/components/admin/admin-console-context';
import {
  CATALOG_TEMPLATE_CSV_URL,
  CATALOG_TEMPLATE_XLSX_URL,
  PHOTO_UPLOAD_MAX_FILES,
  PHOTO_UPLOAD_SPACING_MS,
  batchSelectionError,
  buildPhotoMap,
  catalogImportFileError,
  importSummaryText,
  previewActionLabel,
  resolvePhotoNames,
  toggleSkuSelection,
  type CatalogPreviewRow,
} from '@/lib/catalog-import-ui';
import { shippingDataStatusText, shippingDataTone, type ShippingDataSummary } from '@/lib/admin-shipping-data';
import { matrixToCsv, parseCsvMatrix, readSpreadsheetFile, type Matrix } from '@/lib/spreadsheet-read';

type ImportMode = 'upsert' | 'create_only';

type ImportReport = {
  dryRun: boolean;
  mode: ImportMode;
  applied: boolean;
  created: number;
  updated: number;
  failed: number;
  toCreate: number;
  toUpdate: number;
  errors: { line: number; sku?: string; message: string }[];
  errorsTruncated: boolean;
  fileError: string | null;
  deleted: number;
  preview: CatalogPreviewRow[];
};

type UploadedPhoto = { name: string; size: number; url: string };

const PHOTO_MAX_BYTES = 15 * 1024 * 1024;
const PHOTO_EXT = /\.(jpe?g|png|webp)$/i;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
  const [fileName, setFileName] = useState('');
  const [sheet, setSheet] = useState<Matrix | null>(null);
  const [pasted, setPasted] = useState('');
  const [mode, setMode] = useState<ImportMode>('upsert');
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoProgress, setPhotoProgress] = useState<{ done: number; total: number; failed: string[] } | null>(null);
  const photoCancel = useRef(false);
  const [preview, setPreview] = useState<ImportReport | null>(null);
  const [previewCsv, setPreviewCsv] = useState('');
  const [missingPhotos, setMissingPhotos] = useState<string[]>([]);
  const [skipInvalid, setSkipInvalid] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [importErr, setImportErr] = useState('');

  const [shipData, setShipData] = useState<ShippingDataSummary | null>(null);
  const [shipBusy, setShipBusy] = useState(false);
  const [shipErr, setShipErr] = useState('');

  async function checkShippingData(download: boolean) {
    setShipBusy(true);
    setShipErr('');
    try {
      const data = await api<{ filename: string; summary: ShippingDataSummary; csv: string }>(
        '/admin/ops/products-missing-shipping-data',
      );
      setShipData(data.summary);
      if (download && data.summary.missingCount > 0) {
        const blob = new Blob([`\uFEFF${data.csv || ''}`], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = data.filename || 'produtos-sem-peso-medidas.csv';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }
    } catch (e: any) {
      setShipErr(e?.message || 'Não foi possível conferir peso e medidas.');
    } finally {
      setShipBusy(false);
    }
  }

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

  function resetPreview() {
    setPreview(null);
    setPreviewCsv('');
    setMissingPhotos([]);
    setSkipInvalid(false);
  }

  async function onFile(file: File | null) {
    setImportErr('');
    setImportReport(null);
    resetPreview();
    setSheet(null);
    setFileName('');
    if (!file) return;
    try {
      const rows = await readSpreadsheetFile(file);
      if (rows.length < 2) {
        setImportErr('A planilha não tem produtos (só o cabeçalho ou nada). Nada foi enviado.');
        return;
      }
      setSheet(rows);
      setFileName(file.name);
    } catch (e) {
      setImportErr(e instanceof Error ? e.message : 'Não consegui abrir a planilha.');
    }
  }

  async function onPhotos(list: FileList | null) {
    const files = Array.from(list || []);
    if (!files.length) return;
    setImportErr('');
    if (files.length > PHOTO_UPLOAD_MAX_FILES) {
      setImportErr(`Escolha no máximo ${PHOTO_UPLOAD_MAX_FILES} fotos por vez.`);
      return;
    }
    const failed: string[] = [];
    const todo = files.filter((f) => {
      if (!PHOTO_EXT.test(f.name)) {
        failed.push(`${f.name} (use JPG, PNG ou WEBP)`);
        return false;
      }
      if (f.size > PHOTO_MAX_BYTES) {
        failed.push(`${f.name} (maior que 15 MB)`);
        return false;
      }
      return !photos.some((p) => p.name === f.name && p.size === f.size);
    });
    resetPreview();
    photoCancel.current = false;
    setPhotoBusy(true);
    setPhotoProgress({ done: 0, total: todo.length, failed: [...failed] });
    const sent: UploadedPhoto[] = [];
    for (let i = 0; i < todo.length; i++) {
      if (photoCancel.current) break;
      const f = todo[i];
      if (i > 0) await wait(PHOTO_UPLOAD_SPACING_MS);
      try {
        const fd = new FormData();
        fd.append('file', f);
        const res = await apiUpload<{ url: string }>('/admin/uploads', fd);
        const item = { name: f.name, size: f.size, url: res.url };
        sent.push(item);
        setPhotos((prev) => [...prev.filter((p) => p.name.toLowerCase() !== f.name.toLowerCase()), item]);
      } catch (e) {
        failed.push(`${f.name} (${e instanceof Error ? e.message : 'falhou'})`);
      }
      setPhotoProgress({ done: i + 1, total: todo.length, failed: [...failed] });
    }
    setPhotoBusy(false);
  }

  function currentRows(): Matrix | null {
    if (sheet) return sheet;
    if (pasted.trim()) return parseCsvMatrix(pasted);
    return null;
  }

  async function checkSheet() {
    setImportErr('');
    setImportReport(null);
    resetPreview();
    const rows = currentRows();
    if (!rows || rows.length < 2) {
      setImportErr('Escolha a planilha primeiro (botão “Importar planilha”).');
      return;
    }
    const resolved = resolvePhotoNames(rows, buildPhotoMap(photos));
    const csv = matrixToCsv(resolved.rows);
    const problem = catalogImportFileError(csv);
    if (problem) {
      setImportErr(problem);
      return;
    }
    setImportBusy(true);
    try {
      const report = await api<ImportReport>('/admin/products/import', {
        method: 'POST',
        body: JSON.stringify({ csv, dryRun: true, mode }),
      });
      setPreview(report);
      setPreviewCsv(csv);
      setMissingPhotos(resolved.missing);
    } catch (e) {
      setImportErr(e instanceof Error ? e.message : 'Falha ao conferir. Nada foi gravado.');
    } finally {
      setImportBusy(false);
    }
  }

  async function applyImport() {
    if (!preview || !previewCsv) return;
    const total = preview.toCreate + preview.toUpdate;
    if (!total) return;
    const hasErrors = preview.failed > 0;
    if (hasErrors && !skipInvalid) return;
    const msg =
      `Gravar agora? ${importSummaryText(preview)}.` +
      (hasErrors ? ' As linhas com erro ficam de fora.' : '') +
      ' Nenhum produto é apagado. Se algo falhar no meio, nada é gravado.';
    if (!window.confirm(msg)) return;
    setImportBusy(true);
    setImportErr('');
    try {
      const report = await api<ImportReport>('/admin/products/import', {
        method: 'POST',
        body: JSON.stringify({ csv: previewCsv, dryRun: false, mode, skipInvalid: hasErrors }),
      });
      setImportReport(report);
      if (report.applied && report.created + report.updated > 0) {
        resetPreview();
        await load();
      }
    } catch (e) {
      setImportErr(e instanceof Error ? e.message : 'Falha na importação. Nada foi gravado.');
    } finally {
      setImportBusy(false);
    }
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
        <h3 style={{ marginTop: 4 }}>Importar planilha de produtos</h3>
        <ol className="muted admin-import-help" style={{ paddingLeft: 18 }}>
          <li>Baixe o modelo, preencha uma linha por produto e salve (Excel .xlsx ou CSV).</li>
          <li>Se a planilha usa nomes de arquivo na coluna “fotos”, envie as fotos em “Enviar fotos”.</li>
          <li>Clique em “Conferir planilha”. Nada é gravado nesta etapa: você vê cada linha e os erros.</li>
          <li>Se estiver tudo certo, clique em “Gravar”. Nenhum produto é apagado; células vazias não apagam o que já existe.</li>
        </ol>
        <p className="muted admin-import-help">
          Passo a passo completo: docs/IMPORTACAO_PRODUTOS.md. Máximo de 500 produtos por planilha.
        </p>

        <div className="admin-import-actions">
          <a className="btn ghost admin-btn-ghost-pro" href={CATALOG_TEMPLATE_XLSX_URL} download>
            Baixar modelo (Excel)
          </a>
          <a className="btn ghost admin-btn-ghost-pro" href={CATALOG_TEMPLATE_CSV_URL} download>
            Baixar modelo (CSV)
          </a>
        </div>

        <div className="admin-import-shipping" data-testid="admin-shipping-data">
          <h3 style={{ marginTop: 12 }}>Peso e medidas (frete)</h3>
          <div className="admin-import-actions">
            <button type="button" className="btn ghost admin-btn-ghost-pro" disabled={shipBusy} onClick={() => void checkShippingData(false)}>
              {shipBusy ? 'Conferindo…' : 'Conferir produtos sem peso/medidas'}
            </button>
            {shipData && shipData.missingCount > 0 ? (
              <button type="button" className="btn ghost admin-btn-ghost-pro" disabled={shipBusy} onClick={() => void checkShippingData(true)}>
                Baixar lista (CSV)
              </button>
            ) : null}
          </div>
          {shipData ? (
            <p className={shippingDataTone(shipData) === 'warn' ? 'admin-catalog-alert' : 'muted'} role="status">
              {shippingDataStatusText(shipData)}
            </p>
          ) : null}
          {shipErr ? (
            <p role="alert" className="admin-catalog-alert admin-catalog-alert--danger">
              {shipErr}
            </p>
          ) : null}
        </div>

        <div className="admin-import-actions">
          <label className="btn" style={{ cursor: 'pointer' }}>
            Importar planilha
            <input
              type="file"
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain"
              style={{ display: 'none' }}
              onChange={(e) => {
                void onFile(e.target.files?.[0] || null);
                e.target.value = '';
              }}
            />
          </label>
          <label className="btn ghost admin-btn-ghost-pro" style={{ cursor: photoBusy ? 'wait' : 'pointer' }}>
            Enviar fotos (opcional)
            <input
              type="file"
              multiple
              disabled={photoBusy}
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={(e) => {
                void onPhotos(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
          {photoBusy ? (
            <button type="button" className="btn ghost" onClick={() => (photoCancel.current = true)}>
              Parar envio de fotos
            </button>
          ) : null}
        </div>

        {fileName ? (
          <p className="muted" style={{ fontSize: 13 }}>
            Planilha: <strong>{fileName}</strong> · {(sheet?.length || 1) - 1} linha(s) de produto
          </p>
        ) : null}
        {photoProgress ? (
          <p className="muted" style={{ fontSize: 13 }} role="status">
            {photoBusy
              ? `Enviando fotos: ${photoProgress.done} de ${photoProgress.total} (uma a cada ${PHOTO_UPLOAD_SPACING_MS / 1000} s)…`
              : `Fotos enviadas nesta tela: ${photos.length}.`}
            {photoProgress.failed.length ? ` Não enviadas: ${photoProgress.failed.join('; ')}.` : ''}
          </p>
        ) : null}
        {photos.length && !photoBusy ? (
          <details>
            <summary className="muted" style={{ fontSize: 13 }}>
              Ver nomes das {photos.length} foto(s) enviadas
            </summary>
            <p className="muted" style={{ fontSize: 12 }}>{photos.map((p) => p.name).join(', ')}</p>
          </details>
        ) : null}

        <fieldset style={{ border: 0, padding: 0, margin: '8px 0' }}>
          <legend style={{ fontWeight: 600 }}>Se o SKU já existir na loja</legend>
          <label style={{ display: 'block' }}>
            <input
              type="radio"
              name="import-mode"
              checked={mode === 'upsert'}
              onChange={() => {
                setMode('upsert');
                resetPreview();
              }}
            />{' '}
            Atualizar o produto existente (recomendado; não duplica)
          </label>
          <label style={{ display: 'block' }}>
            <input
              type="radio"
              name="import-mode"
              checked={mode === 'create_only'}
              onChange={() => {
                setMode('create_only');
                resetPreview();
              }}
            />{' '}
            Só criar produtos novos (SKU que já existe vira erro e não é alterado)
          </label>
        </fieldset>

        <div className="admin-import-actions">
          <button
            type="button"
            className="btn"
            disabled={importBusy || photoBusy || (!sheet && !pasted.trim())}
            onClick={() => void checkSheet()}
          >
            {importBusy && !preview ? 'Conferindo…' : 'Conferir planilha'}
          </button>
        </div>

        <details style={{ marginTop: 6 }}>
          <summary className="muted" style={{ fontSize: 13 }}>
            Avançado: colar CSV em vez de escolher arquivo
          </summary>
          <label>
            CSV (separado por ; ou ,)
            <textarea
              rows={6}
              value={pasted}
              onChange={(e) => {
                setPasted(e.target.value);
                setSheet(null);
                setFileName('');
                setImportErr('');
                resetPreview();
              }}
              placeholder="sku;nome;categoria;preco;estoque"
              spellCheck={false}
            />
          </label>
        </details>

        {importErr ? (
          <p role="alert" className="alert admin-catalog-alert--danger">
            {importErr}
          </p>
        ) : null}

        {preview ? (
          <div className="admin-import-report" role="status">
            <p>
              <strong>Conferência (nada foi gravado ainda):</strong> {importSummaryText(preview)}
            </p>
            {preview.fileError && !preview.preview.length ? <p>{preview.fileError}</p> : null}
            {missingPhotos.length ? (
              <p>
                Fotos citadas na planilha que ainda não foram enviadas: {missingPhotos.slice(0, 20).join(', ')}
                {missingPhotos.length > 20 ? '…' : ''}. Envie em “Enviar fotos” e confira de novo.
              </p>
            ) : null}
            {preview.preview.length ? (
              <div style={{ overflowX: 'auto', maxHeight: 480, overflowY: 'auto' }}>
                <table className="admin-import-table">
                  <thead>
                    <tr>
                      <th>Linha</th>
                      <th>SKU</th>
                      <th>Ação</th>
                      <th>Nome</th>
                      <th>Preço</th>
                      <th>Preço “de”</th>
                      <th>Estoque</th>
                      <th>Categoria</th>
                      <th>Fotos</th>
                      <th>Observações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.preview.map((row) => (
                      <tr
                        key={`${row.line}-${row.sku || ''}`}
                        style={row.action === 'error' ? { background: 'rgba(220, 38, 38, 0.08)' } : undefined}
                      >
                        <td>{row.line}</td>
                        <td>{row.sku || '—'}</td>
                        <td>
                          <strong>{previewActionLabel(row.action)}</strong>
                        </td>
                        <td>{row.name || '—'}</td>
                        <td>{row.price != null ? brl(row.price) : '—'}</td>
                        <td>{row.compareAtPrice != null ? brl(row.compareAtPrice) : '—'}</td>
                        <td>{row.stock ?? '—'}</td>
                        <td>{row.category || '—'}</td>
                        <td>{row.photos || '—'}</td>
                        <td style={{ minWidth: 220 }}>
                          {row.message ? <div style={{ color: '#b91c1c' }}>{row.message}</div> : null}
                          {row.warnings.map((w) => (
                            <div key={w} className="muted" style={{ fontSize: 12 }}>
                              Atenção: {w}
                            </div>
                          ))}
                          {row.active === false ? (
                            <div className="muted" style={{ fontSize: 12 }}>
                              Fica desativado (não aparece na loja).
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {preview.errorsTruncated ? <p>Muitos erros: a lista foi cortada. Corrija os primeiros e confira de novo.</p> : null}
            {preview.failed > 0 && preview.toCreate + preview.toUpdate > 0 ? (
              <label style={{ display: 'block', marginTop: 8 }}>
                <input type="checkbox" checked={skipInvalid} onChange={(e) => setSkipInvalid(e.target.checked)} /> Gravar só
                as linhas sem erro (as {preview.failed} com erro ficam de fora)
              </label>
            ) : null}
            {preview.toCreate + preview.toUpdate > 0 ? (
              <div className="admin-import-actions">
                <button
                  type="button"
                  className="btn"
                  disabled={importBusy || (preview.failed > 0 && !skipInvalid)}
                  onClick={() => void applyImport()}
                >
                  {importBusy ? 'Gravando…' : `Gravar ${preview.toCreate + preview.toUpdate} produto(s)`}
                </button>
                {preview.failed > 0 && !skipInvalid ? (
                  <span className="muted" style={{ fontSize: 13 }}>
                    Corrija a planilha e confira de novo, ou marque “Gravar só as linhas sem erro”.
                  </span>
                ) : null}
              </div>
            ) : (
              <p>Nenhuma linha pronta para gravar. Corrija a planilha e confira de novo.</p>
            )}
          </div>
        ) : null}

        {importReport ? (
          <div className="admin-import-report" role="status">
            {importReport.applied ? (
              <p>
                <strong>Gravado.</strong> Criados: {importReport.created} · Atualizados: {importReport.updated} · Linhas
                ignoradas por erro: {importReport.failed} · Apagados: {importReport.deleted}
              </p>
            ) : (
              <p>
                <strong>Nada foi gravado.</strong> {importReport.fileError || ''}
              </p>
            )}
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
