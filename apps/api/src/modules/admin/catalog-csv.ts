/**
 * Pure CSV parse / validate / upsert planning for admin catalog import.
 * No database. No product rows are invented here — callers pass existing SKUs.
 * Import never deletes products. Empty cells do not erase stored values.
 * A coluna isDemo / demo é ignorada de propósito: o CSV comercial nunca liga
 * o catálogo demonstrativo. O seed DEMO é um script separado.
 */

import { CREATE_IMAGE_URL_MAX, placeholderProductImageUrlError } from './admin-product-images';

/** Stay under the API JSON body limit (1mb) even if quotes are escaped. */
export const CATALOG_CSV_MAX_CHARS = 450_000;
/** One request = one safe batch. Larger files are rejected before any write. */
export const CATALOG_CSV_MAX_ROWS = 500;
export const CATALOG_CSV_MAX_ERROR_REPORT = 100;

export const CATALOG_CSV_TEMPLATE =
  'sku;nome;descricao;preco;preco_de;estoque;ativo;categoria;peso_kg;largura_cm;altura_cm;comprimento_cm;imagens\n';

const DANGEROUS_HEADERS = new Set([
  'delete',
  'apagar',
  'wipe',
  'truncate',
  'drop',
  'excluir',
  'remover',
  'destroy',
]);

const HEADER_ALIASES: Record<string, CatalogCsvField> = {
  sku: 'sku',
  codigo: 'sku',
  código: 'sku',
  code: 'sku',
  nome: 'name',
  name: 'name',
  produto: 'name',
  descricao: 'description',
  descrição: 'description',
  description: 'description',
  preco: 'price',
  preço: 'price',
  price: 'price',
  preco_de: 'compareAtPrice',
  preço_de: 'compareAtPrice',
  precode: 'compareAtPrice',
  compareatprice: 'compareAtPrice',
  compare_at: 'compareAtPrice',
  compare_at_price: 'compareAtPrice',
  estoque: 'stock',
  stock: 'stock',
  ativo: 'active',
  active: 'active',
  categoria: 'category',
  category: 'category',
  peso_kg: 'weightKg',
  pesokg: 'weightKg',
  weightkg: 'weightKg',
  largura_cm: 'widthCm',
  larguracm: 'widthCm',
  widthcm: 'widthCm',
  altura_cm: 'heightCm',
  alturacm: 'heightCm',
  heightcm: 'heightCm',
  comprimento_cm: 'lengthCm',
  comprimentocm: 'lengthCm',
  lengthcm: 'lengthCm',
  imagens: 'imageUrls',
  fotos: 'imageUrls',
  imageurls: 'imageUrls',
  images: 'imageUrls',
  slug: 'slug',
};

export type CatalogCsvField =
  | 'sku'
  | 'name'
  | 'description'
  | 'price'
  | 'compareAtPrice'
  | 'stock'
  | 'active'
  | 'category'
  | 'weightKg'
  | 'widthCm'
  | 'heightCm'
  | 'lengthCm'
  | 'imageUrls'
  | 'slug';

export type CatalogRowError = {
  line: number;
  sku?: string;
  message: string;
};

export type ValidatedCatalogRow = {
  line: number;
  sku: string;
  name?: string;
  description?: string;
  price?: number;
  compareAtPrice?: number;
  stock?: number;
  active?: boolean;
  category?: string;
  slug?: string;
  weightKg?: number;
  widthCm?: number;
  heightCm?: number;
  lengthCm?: number;
  imageUrls?: string[];
};

export type CatalogCsvValidation = {
  fileError: string | null;
  rows: ValidatedCatalogRow[];
  errors: CatalogRowError[];
};

export type CatalogUpsertAction =
  | { kind: 'create'; row: ValidatedCatalogRow }
  | { kind: 'update'; row: ValidatedCatalogRow };

export type CatalogUpsertPlan = {
  actions: CatalogUpsertAction[];
  errors: CatalogRowError[];
};

const PRICE_MAX = 9_999_999.99;
const STOCK_MAX = 1_000_000;
const NAME_MAX = 160;
const DESCRIPTION_MAX = 4000;
const SKU_MAX = 64;

export function slugifyProductName(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'produto'
  );
}

/** Brazilian and dot-decimal money. Returns null when the cell is not a price. */
export function parseCatalogMoney(raw: string): number | null {
  let s = raw.trim().replace(/\s/g, '').replace(/^r\$/i, '');
  if (!s || !/^[\d.,]+$/.test(s)) return null;
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (hasComma) {
    s = s.replace(',', '.');
  } else if (hasDot) {
    const parts = s.split('.');
    const thousands =
      parts.length >= 2 &&
      parts.slice(1).every((p) => p.length === 3) &&
      parts[0].length >= 1 &&
      parts[0].length <= 3;
    if (thousands) s = parts.join('');
  }
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > PRICE_MAX) return null;
  return Math.round(n * 100) / 100;
}

export function parseCatalogActive(raw: string): boolean | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (['1', 'true', 'sim', 's', 'yes', 'y', 'ativo', 'active'].includes(s)) return true;
  if (['0', 'false', 'nao', 'não', 'n', 'no', 'inativo', 'inactive'].includes(s)) return false;
  return null;
}

export function matchCategory(
  raw: string | undefined,
  categories: { id: string; slug: string; name: string }[],
): { kind: 'omit' } | { kind: 'id'; id: string } | { kind: 'error'; message: string } {
  const t = (raw || '').trim();
  if (!t) return { kind: 'omit' };
  const key = t.toLowerCase();
  const bySlug = categories.find((c) => c.slug.toLowerCase() === key);
  if (bySlug) return { kind: 'id', id: bySlug.id };
  const byName = categories.filter((c) => c.name.toLowerCase() === key);
  if (byName.length === 1) return { kind: 'id', id: byName[0].id };
  if (byName.length > 1) return { kind: 'error', message: `Categoria ambígua: ${t}` };
  return { kind: 'error', message: `Categoria não encontrada: ${t}` };
}

export function validateCatalogCsv(text: string): CatalogCsvValidation {
  const empty: CatalogCsvValidation = { fileError: null, rows: [], errors: [] };
  if (typeof text !== 'string') {
    return { ...empty, fileError: 'Arquivo inválido. Nada foi gravado.' };
  }
  if (text.includes('\0')) {
    return { ...empty, fileError: 'Arquivo inválido. Nada foi gravado.' };
  }
  if (text.length > CATALOG_CSV_MAX_CHARS) {
    return {
      ...empty,
      fileError: `Arquivo grande demais (máx. ${CATALOG_CSV_MAX_CHARS} caracteres). Divida o CSV. Nada foi gravado.`,
    };
  }
  const stripped = text.replace(/^\uFEFF/, '').trim();
  if (!stripped) {
    return { ...empty, fileError: 'Arquivo vazio. Nada foi gravado.' };
  }

  const records = splitCsvRecords(stripped);
  const headerLine = records[0] ?? '';
  const delimiter = detectDelimiter(headerLine);
  if (!delimiter) {
    return { ...empty, fileError: 'Cabeçalho CSV sem separador (, ou ;). Nada foi gravado.' };
  }
  const headers = parseCsvLine(headerLine, delimiter).map((h) => normalizeHeader(h));
  if (headers.some((h) => DANGEROUS_HEADERS.has(h))) {
    return {
      ...empty,
      fileError: 'CSV com coluna de exclusão. A importação não apaga produtos. Nada foi gravado.',
    };
  }
  const fields = headers.map((h) => HEADER_ALIASES[h] || null);
  if (!fields.includes('sku')) {
    return { ...empty, fileError: 'Coluna sku obrigatória. Nada foi gravado.' };
  }

  const dataRecords = records.slice(1).filter((r) => r.trim() !== '');
  if (dataRecords.length === 0) {
    return { ...empty, fileError: 'CSV sem linhas de produto. Nada foi gravado.' };
  }
  if (dataRecords.length > CATALOG_CSV_MAX_ROWS) {
    return {
      ...empty,
      fileError: `Máximo de ${CATALOG_CSV_MAX_ROWS} linhas por envio (há ${dataRecords.length}). Divida a planilha. Nada foi gravado.`,
    };
  }

  const rows: ValidatedCatalogRow[] = [];
  const errors: CatalogRowError[] = [];
  const seen = new Set<string>();

  dataRecords.forEach((record, index) => {
    const line = index + 2;
    const cells = parseCsvLine(record, delimiter);
    if (cells.every((c) => c.trim() === '')) return;
    const bag = new Map<CatalogCsvField, string>();
    fields.forEach((field, i) => {
      if (!field) return;
      if (!bag.has(field)) bag.set(field, cells[i] ?? '');
    });
    const skuRaw = (bag.get('sku') || '').trim();
    if (!skuRaw) {
      errors.push({ line, message: 'SKU vazio.' });
      return;
    }
    if (skuRaw.length < 2 || skuRaw.length > SKU_MAX || /[\u0000-\u001f]/.test(skuRaw)) {
      errors.push({ line, sku: skuRaw.slice(0, 64), message: 'SKU inválido (2 a 64 caracteres, sem quebra de linha).' });
      return;
    }
    if (seen.has(skuRaw)) {
      errors.push({ line, sku: skuRaw, message: 'SKU repetido neste arquivo. A primeira ocorrência foi mantida.' });
      return;
    }
    seen.add(skuRaw);

    const built = buildRow(line, skuRaw, bag);
    if ('message' in built) {
      errors.push({ line, sku: skuRaw, message: built.message });
      return;
    }
    rows.push(built);
  });

  return { fileError: null, rows, errors };
}

/**
 * Split validated rows into create vs update. Does not delete.
 * Create requires name + price. Update requires at least one field besides SKU.
 */
export function planCatalogUpserts(
  rows: ValidatedCatalogRow[],
  existingSkus: ReadonlySet<string>,
): CatalogUpsertPlan {
  const actions: CatalogUpsertAction[] = [];
  const errors: CatalogRowError[] = [];
  for (const row of rows) {
    const exists = existingSkus.has(row.sku);
    if (!exists) {
      if (!row.name) {
        errors.push({ line: row.line, sku: row.sku, message: 'Nome obrigatório para produto novo.' });
        continue;
      }
      if (row.price == null) {
        errors.push({ line: row.line, sku: row.sku, message: 'Preço obrigatório para produto novo.' });
        continue;
      }
      actions.push({ kind: 'create', row });
      continue;
    }
    if (!rowHasUpdate(row)) {
      errors.push({ line: row.line, sku: row.sku, message: 'Nada para atualizar neste SKU.' });
      continue;
    }
    actions.push({ kind: 'update', row });
  }
  return { actions, errors };
}

export function capCatalogErrors<T>(errors: T[], max = CATALOG_CSV_MAX_ERROR_REPORT): { errors: T[]; truncated: boolean } {
  if (errors.length <= max) return { errors, truncated: false };
  return { errors: errors.slice(0, max), truncated: true };
}

function rowHasUpdate(row: ValidatedCatalogRow): boolean {
  return (
    row.name != null ||
    row.description != null ||
    row.price != null ||
    row.compareAtPrice != null ||
    row.stock != null ||
    row.active != null ||
    row.category != null ||
    row.weightKg != null ||
    row.widthCm != null ||
    row.heightCm != null ||
    row.lengthCm != null ||
    (row.imageUrls != null && row.imageUrls.length > 0)
  );
}

function buildRow(
  line: number,
  sku: string,
  bag: Map<CatalogCsvField, string>,
): ValidatedCatalogRow | { message: string } {
  const row: ValidatedCatalogRow = { line, sku };
  const name = cell(bag, 'name');
  if (name != null) {
    if (looksLikeFormula(name)) return { message: 'Nome começa com fórmula de planilha.' };
    if (name.length < 2 || name.length > NAME_MAX) return { message: 'Nome inválido (2 a 160 caracteres).' };
    row.name = name;
  }
  const description = cell(bag, 'description');
  if (description != null) {
    if (looksLikeFormula(description)) return { message: 'Descrição começa com fórmula de planilha.' };
    if (description.length > DESCRIPTION_MAX) return { message: 'Descrição passa de 4000 caracteres.' };
    row.description = description;
  }
  const priceCell = cell(bag, 'price');
  if (priceCell != null) {
    const price = parseCatalogMoney(priceCell);
    if (price == null) return { message: 'Preço inválido.' };
    row.price = price;
  }
  const compareCell = cell(bag, 'compareAtPrice');
  if (compareCell != null) {
    const compare = parseCatalogMoney(compareCell);
    if (compare == null) return { message: 'Preço “de” inválido.' };
    row.compareAtPrice = compare;
  }
  const stockCell = cell(bag, 'stock');
  if (stockCell != null) {
    if (!/^\d+$/.test(stockCell)) return { message: 'Estoque inválido (inteiro ≥ 0).' };
    const stock = Number(stockCell);
    if (!Number.isInteger(stock) || stock > STOCK_MAX) return { message: 'Estoque inválido (inteiro ≥ 0).' };
    row.stock = stock;
  }
  const activeCell = cell(bag, 'active');
  if (activeCell != null) {
    const active = parseCatalogActive(activeCell);
    if (active == null) return { message: 'Ativo inválido (sim/não).' };
    row.active = active;
  }
  const category = cell(bag, 'category');
  if (category != null) {
    if (category.length > 80) return { message: 'Categoria inválida.' };
    row.category = category;
  }
  const slug = cell(bag, 'slug');
  if (slug != null) {
    const normalized = slug.toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized) || normalized.length > 80) {
      return { message: 'Slug inválido.' };
    }
    row.slug = normalized;
  }
  const weight = parseDim(cell(bag, 'weightKg'), 0, 500, 3);
  if (weight === 'bad') return { message: 'Peso inválido (kg).' };
  if (typeof weight === 'number') row.weightKg = weight;
  const width = parseDim(cell(bag, 'widthCm'), 0, 1000, 2);
  if (width === 'bad') return { message: 'Largura inválida (cm).' };
  if (typeof width === 'number') row.widthCm = width;
  const height = parseDim(cell(bag, 'heightCm'), 0, 1000, 2);
  if (height === 'bad') return { message: 'Altura inválida (cm).' };
  if (typeof height === 'number') row.heightCm = height;
  const length = parseDim(cell(bag, 'lengthCm'), 0, 1000, 2);
  if (length === 'bad') return { message: 'Comprimento inválido (cm).' };
  if (typeof length === 'number') row.lengthCm = length;

  const imagesCell = cell(bag, 'imageUrls');
  if (imagesCell != null) {
    const urls = splitImageUrls(imagesCell);
    if (!urls.length) return { message: 'Imagens vazias ou inválidas.' };
    if (urls.length > CREATE_IMAGE_URL_MAX) {
      return { message: `Limite de ${CREATE_IMAGE_URL_MAX} fotos por produto.` };
    }
    for (const url of urls) {
      if (!/^https?:\/\//i.test(url)) return { message: 'URL de imagem precisa começar com http:// ou https://.' };
      const placeholder = placeholderProductImageUrlError(url);
      if (placeholder) return { message: placeholder };
    }
    row.imageUrls = urls;
  }
  return row;
}

/** Empty cell → undefined (do not erase). Missing column → undefined. */
function cell(bag: Map<CatalogCsvField, string>, field: CatalogCsvField): string | undefined {
  if (!bag.has(field)) return undefined;
  const v = (bag.get(field) || '').trim();
  return v ? v : undefined;
}

function looksLikeFormula(value: string): boolean {
  return /^[=+@\t]/.test(value);
}

function parseDim(
  raw: string | undefined,
  min: number,
  max: number,
  places: number,
): number | undefined | 'bad' {
  if (raw == null) return undefined;
  const n = parseCatalogMoney(raw);
  if (n == null || n < min || n > max) return 'bad';
  const factor = 10 ** places;
  return Math.round(n * factor) / factor;
}

function splitImageUrls(raw: string): string[] {
  return raw
    .split(/[|\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeHeader(raw: string): string {
  return raw
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

function detectDelimiter(headerLine: string): ',' | ';' | null {
  const commas = countOutsideQuotes(headerLine, ',');
  const semis = countOutsideQuotes(headerLine, ';');
  if (semis === 0 && commas === 0) return null;
  return semis >= commas ? ';' : ',';
}

function countOutsideQuotes(line: string, ch: string): number {
  let n = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && c === ch) n += 1;
  }
  return n;
}

function splitCsvRecords(text: string): string[] {
  const records: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '""';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      cur += '"';
      continue;
    }
    if (!inQuotes && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      records.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.length) records.push(cur);
  return records;
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delimiter) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}
