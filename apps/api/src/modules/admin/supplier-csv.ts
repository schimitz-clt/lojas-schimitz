/**
 * Importação em lote de fornecedor/custo por SKU (Prime 2). Regras puras, sem I/O.
 * Colunas: sku;fornecedor;codigo_fornecedor;custo;prazo_dias;link;observacoes
 * Tudo ou nada: com qualquer erro, nada é gravado.
 */
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { AdminProductSupplierDto } from './product-supplier';

export class AdminSupplierImportDto {
  @IsString()
  @MaxLength(400_000)
  csv!: string;

  /** true (padrão) = só conferência, nada é gravado. */
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export const SUPPLIER_CSV_MAX_CHARS = 400_000;
export const SUPPLIER_CSV_MAX_ROWS = 2000;
export const SUPPLIER_CSV_COLUMNS = ['sku', 'fornecedor', 'codigo_fornecedor', 'custo', 'prazo_dias', 'link', 'observacoes'] as const;
export const SUPPLIER_CSV_TEMPLATE = `${SUPPLIER_CSV_COLUMNS.join(';')}\n`;

type Field = 'sku' | 'supplierName' | 'supplierSku' | 'costPrice' | 'leadTimeDays' | 'supplierUrl' | 'notes';
const ALIASES: Record<string, Field> = {
  sku: 'sku', codigo: 'sku', código: 'sku',
  fornecedor: 'supplierName', supplier: 'supplierName', supplier_name: 'supplierName',
  codigo_fornecedor: 'supplierSku', código_fornecedor: 'supplierSku', sku_fornecedor: 'supplierSku',
  custo: 'costPrice', cost: 'costPrice', preco_custo: 'costPrice', preço_custo: 'costPrice',
  prazo_dias: 'leadTimeDays', prazo: 'leadTimeDays',
  link: 'supplierUrl', url: 'supplierUrl',
  observacoes: 'notes', observações: 'notes', obs: 'notes',
};

export type SupplierCsvError = { line: number; sku: string | null; message: string };
export type SupplierCsvRow = {
  line: number;
  sku: string;
  data: { supplierName: string; supplierSku: string | null; supplierUrl: string | null; costPrice: number | null; leadTimeDays: number | null; notes: string | null };
};

/** CSV com ; ou , (detecta pelo cabeçalho), aspas e BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] || '';
  const delim = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

function money(raw: string): number | null | 'invalid' {
  const t = raw.trim().replace(/^R\$\s*/i, '');
  if (!t) return null;
  const norm = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  const n = Number(norm);
  return Number.isFinite(n) ? n : 'invalid';
}

export function validateSupplierCsv(text: string): { rows: SupplierCsvRow[]; errors: SupplierCsvError[] } {
  const errors: SupplierCsvError[] = [];
  if (!text || !text.trim()) return { rows: [], errors: [{ line: 0, sku: null, message: 'Planilha vazia.' }] };
  if (text.length > SUPPLIER_CSV_MAX_CHARS) return { rows: [], errors: [{ line: 0, sku: null, message: 'Planilha grande demais (máx. 400 mil caracteres).' }] };
  const matrix = parseCsv(text);
  const header = (matrix[0] || []).map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const idx: Partial<Record<Field, number>> = {};
  header.forEach((h, i) => { const f = ALIASES[h]; if (f && idx[f] === undefined) idx[f] = i; });
  if (idx.sku === undefined || idx.supplierName === undefined) {
    return { rows: [], errors: [{ line: 1, sku: null, message: 'Cabeçalho precisa ter as colunas "sku" e "fornecedor".' }] };
  }
  const body = matrix.slice(1);
  if (body.length > SUPPLIER_CSV_MAX_ROWS) return { rows: [], errors: [{ line: 0, sku: null, message: `No máximo ${SUPPLIER_CSV_MAX_ROWS} linhas por vez.` }] };
  const seen = new Set<string>();
  const rows: SupplierCsvRow[] = [];
  body.forEach((cells, k) => {
    const line = k + 2;
    const get = (f: Field) => (idx[f] === undefined ? '' : String(cells[idx[f]!] ?? '').trim());
    const sku = get('sku');
    if (!sku) { errors.push({ line, sku: null, message: 'SKU vazio.' }); return; }
    if (seen.has(sku.toLowerCase())) { errors.push({ line, sku, message: 'SKU repetido na planilha.' }); return; }
    seen.add(sku.toLowerCase());
    const cost = money(get('costPrice'));
    if (cost === 'invalid') { errors.push({ line, sku, message: 'Custo inválido.' }); return; }
    const leadRaw = get('leadTimeDays');
    const lead = leadRaw === '' ? null : Number(leadRaw);
    const dto = plainToInstance(AdminProductSupplierDto, {
      supplierName: get('supplierName'),
      supplierSku: get('supplierSku'),
      supplierUrl: get('supplierUrl'),
      costPrice: cost,
      leadTimeDays: lead,
      notes: get('notes'),
    });
    const v = validateSync(dto);
    if (v.length) {
      const pt: Record<string, string> = { supplierName: 'fornecedor', supplierSku: 'código do fornecedor', supplierUrl: 'link', costPrice: 'custo', leadTimeDays: 'prazo (0 a 365 dias)', notes: 'observações' };
      errors.push({ line, sku, message: `Campo inválido: ${v.map((e) => pt[e.property] || e.property).join(', ')}.` });
      return;
    }
    rows.push({
      line, sku,
      data: {
        supplierName: dto.supplierName,
        supplierSku: dto.supplierSku ?? null,
        supplierUrl: dto.supplierUrl ?? null,
        costPrice: dto.costPrice ?? null,
        leadTimeDays: dto.leadTimeDays ?? null,
        notes: dto.notes ?? null,
      },
    });
  });
  return { rows, errors };
}

export type SupplierImportPreviewRow = {
  line: number;
  sku: string;
  productName: string;
  action: 'criar' | 'atualizar' | 'sem mudança';
  before: { supplierName: string; costPrice: number | null } | null;
  after: { supplierName: string; costPrice: number | null; leadTimeDays: number | null };
};

/** Cruza linhas válidas com produtos reais e o cadastro atual. SKU inexistente vira erro. */
export function planSupplierImport(
  rows: SupplierCsvRow[],
  products: { id: string; sku: string; name: string; supplier: { supplierName: string; supplierSku: string | null; supplierUrl: string | null; costPrice: number | null; leadTimeDays: number | null; notes: string | null } | null }[],
) {
  const bySku = new Map(products.map((p) => [p.sku.toLowerCase(), p]));
  const errors: SupplierCsvError[] = [];
  const preview: SupplierImportPreviewRow[] = [];
  const writes: { productId: string; data: SupplierCsvRow['data'] }[] = [];
  for (const r of rows) {
    const p = bySku.get(r.sku.toLowerCase());
    if (!p) { errors.push({ line: r.line, sku: r.sku, message: 'SKU não existe no catálogo.' }); continue; }
    const cur = p.supplier;
    const same = cur && cur.supplierName === r.data.supplierName && cur.supplierSku === r.data.supplierSku && cur.supplierUrl === r.data.supplierUrl
      && (cur.costPrice ?? null) === r.data.costPrice && (cur.leadTimeDays ?? null) === r.data.leadTimeDays && (cur.notes ?? null) === r.data.notes;
    const action = !cur ? 'criar' : same ? 'sem mudança' : 'atualizar';
    preview.push({
      line: r.line, sku: p.sku, productName: p.name, action,
      before: cur ? { supplierName: cur.supplierName, costPrice: cur.costPrice ?? null } : null,
      after: { supplierName: r.data.supplierName, costPrice: r.data.costPrice, leadTimeDays: r.data.leadTimeDays },
    });
    if (action !== 'sem mudança') writes.push({ productId: p.id, data: r.data });
  }
  const count = (a: string) => preview.filter((x) => x.action === a).length;
  return { errors, preview, writes, summary: { criar: count('criar'), atualizar: count('atualizar'), semMudanca: count('sem mudança') } };
}
