/** Client-side guards for the admin Importação panel. The API re-validates before any write. */

export const CATALOG_IMPORT_MAX_CHARS = 450_000;

/** Mesmas colunas de CATALOG_TEMPLATE_COLUMNS na API (catalog-csv.ts). */
export const CATALOG_IMPORT_COLUMNS = [
  'sku',
  'nome',
  'descricao',
  'categoria',
  'preco',
  'preco_de',
  'estoque',
  'ativo',
  'peso_kg',
  'largura_cm',
  'altura_cm',
  'comprimento_cm',
  'fotos',
] as const;

export const CATALOG_IMPORT_TEMPLATE = `${CATALOG_IMPORT_COLUMNS.join(';')}\n`;

/** Modelos prontos em apps/web/public/modelos (gerados por scripts/gerar-modelo-importacao.ts). */
export const CATALOG_TEMPLATE_XLSX_URL = '/modelos/modelo-importacao-produtos.xlsx';
export const CATALOG_TEMPLATE_CSV_URL = '/modelos/modelo-importacao-produtos.csv';

/** Upload de fotos: API aceita 40/min por admin. Uma a cada 1,6 s fica abaixo disso. */
export const PHOTO_UPLOAD_SPACING_MS = 1600;
export const PHOTO_UPLOAD_MAX_FILES = 300;

const PHOTO_HEADERS = new Set(['fotos', 'imagens', 'images', 'imageurls']);

function normalizeHeaderCell(raw: string): string {
  return String(raw || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

/** "C:\\fotos\\Geladeira 1.JPG" → "geladeira 1.jpg" */
export function photoKey(name: string): string {
  const base = String(name || '').trim().split(/[\\/]/).pop() || '';
  return base.toLowerCase();
}

function photoKeyNoExt(name: string): string {
  return photoKey(name).replace(/\.(jpe?g|png|webp)$/i, '');
}

/** Mapa nome-do-arquivo → link, com e sem extensão. */
export function buildPhotoMap(uploaded: { name: string; url: string }[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const u of uploaded) {
    map.set(photoKey(u.name), u.url);
    const bare = photoKeyNoExt(u.name);
    if (!map.has(bare)) map.set(bare, u.url);
  }
  return map;
}

/** Separa a célula de fotos: `|` ou quebra de linha; nomes de arquivo também por `,` ou `;`. */
export function splitPhotoCell(cell: string): string[] {
  const out: string[] = [];
  for (const part of String(cell || '').split(/[|\n\r]+/)) {
    const t = part.trim();
    if (!t) continue;
    if (/^https?:\/\//i.test(t)) out.push(t);
    else out.push(...t.split(/[,;]+/).map((x) => x.trim()).filter(Boolean));
  }
  return out;
}

/**
 * Troca nomes de arquivo da coluna "fotos" pelos links das fotos enviadas no painel.
 * Links http(s) ficam como estão. Nomes sem foto enviada voltam em `missing`
 * (a API recusa a linha com mensagem clara).
 */
export function resolvePhotoNames(
  rows: string[][],
  photos: Map<string, string>,
): { rows: string[][]; missing: string[]; replaced: number } {
  if (!rows.length) return { rows, missing: [], replaced: 0 };
  const col = rows[0].findIndex((h) => PHOTO_HEADERS.has(normalizeHeaderCell(h)));
  if (col < 0) return { rows, missing: [], replaced: 0 };
  const missing: string[] = [];
  let replaced = 0;
  const out = rows.map((row, i) => {
    if (i === 0 || !row[col]?.trim()) return row;
    const tokens = splitPhotoCell(row[col]).map((t) => {
      if (/^https?:\/\//i.test(t)) return t;
      const url = photos.get(photoKey(t)) || photos.get(photoKeyNoExt(t));
      if (url) {
        replaced += 1;
        return url;
      }
      missing.push(t);
      return t;
    });
    const copy = [...row];
    copy[col] = tokens.join('|');
    return copy;
  });
  return { rows: out, missing: Array.from(new Set(missing)), replaced };
}

export type CatalogPreviewRow = {
  line: number;
  sku: string | null;
  action: 'create' | 'update' | 'error';
  name: string | null;
  price: number | null;
  compareAtPrice: number | null;
  stock: number | null;
  category: string | null;
  photos: number;
  active: boolean | null;
  message: string | null;
  warnings: string[];
};

export function previewActionLabel(action: CatalogPreviewRow['action']): string {
  if (action === 'create') return 'Novo';
  if (action === 'update') return 'Atualizar';
  return 'Erro';
}

export function importSummaryText(r: { toCreate: number; toUpdate: number; failed: number }): string {
  const parts = [
    `${r.toCreate} produto(s) novo(s)`,
    `${r.toUpdate} atualização(ões)`,
    `${r.failed} linha(s) com erro`,
  ];
  return parts.join(' · ');
}

export function catalogImportFileError(text: string): string | null {
  if (typeof text !== 'string' || !text.trim()) return 'Arquivo vazio. Nada foi enviado.';
  if (text.includes('\0')) return 'Arquivo inválido. Nada foi enviado.';
  if (text.length > CATALOG_IMPORT_MAX_CHARS) {
    return 'Arquivo grande demais. Divida o CSV (máx. 500 linhas por envio). Nada foi enviado.';
  }
  return null;
}

export function toggleSkuSelection(selected: string[], sku: string): string[] {
  return selected.includes(sku) ? selected.filter((s) => s !== sku) : [...selected, sku];
}

export function batchSelectionError(count: number): string | null {
  if (count < 1) return 'Marque ao menos um SKU desta página. O restante do catálogo não muda.';
  if (count > 200) return 'Máximo de 200 SKUs por lote.';
  return null;
}
