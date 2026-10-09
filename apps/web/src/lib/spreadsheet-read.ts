/**
 * Leitura de planilha no navegador (sem dependências externas):
 * - CSV com `;` ou `,` (Excel em português salva com `;`).
 * - .xlsx (Excel / Google Planilhas / LibreOffice): lê só a primeira aba.
 * A planilha vira uma matriz de textos e depois um CSV com `;`, que a API valida.
 * Números do Excel saem com vírgula decimal (1299.9 → "1299,9") para não
 * serem lidos como milhar pela API.
 */

export const SPREADSHEET_MAX_BYTES = 5 * 1024 * 1024;
/** Limite do conteúdo descompactado de cada arquivo interno do .xlsx (proteção contra zip-bomba). */
export const XLSX_MAX_ENTRY_BYTES = 30 * 1024 * 1024;

export type Matrix = string[][];

export class SpreadsheetError extends Error {}

/* ----------------------------------------------------------------- CSV */

export function detectCsvDelimiter(firstLine: string): ';' | ',' {
  let semis = 0;
  let commas = 0;
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch === ';') semis += 1;
    else if (!inQuotes && ch === ',') commas += 1;
  }
  return semis >= commas ? ';' : ',';
}

export function parseCsvMatrix(text: string): Matrix {
  const src = text.replace(/^\uFEFF/, '');
  const firstBreak = src.search(/\r?\n/);
  const delimiter = detectCsvDelimiter(firstBreak === -1 ? src : src.slice(0, firstBreak));
  const rows: Matrix = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else inQuotes = false;
      } else cur += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === delimiter) {
      row.push(cur);
      cur = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
    } else cur += ch;
  }
  if (cur !== '' || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return trimMatrix(rows);
}

function csvCell(value: string): string {
  const v = value ?? '';
  return /[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Matriz → CSV com `;` (formato que a API espera). */
export function matrixToCsv(rows: Matrix): string {
  return `${rows.map((r) => r.map(csvCell).join(';')).join('\n')}\n`;
}

/** Remove linhas totalmente vazias do fim e colunas vazias à direita. */
export function trimMatrix(rows: Matrix): Matrix {
  const out = rows.map((r) => {
    const copy = [...r];
    while (copy.length && !String(copy[copy.length - 1] ?? '').trim()) copy.pop();
    return copy;
  });
  while (out.length && out[out.length - 1].every((c) => !String(c ?? '').trim())) out.pop();
  return out;
}

/* ---------------------------------------------------------------- XLSX */

export function isXlsxFileName(name: string): boolean {
  return /\.xlsx$/i.test(name.trim());
}

export function looksLikeZip(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

/** Excel guarda número como double: inteiro fica igual; decimal sai com vírgula. */
export function xlsxNumberToText(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  if (Number.isInteger(n)) return Math.abs(n) >= 1e21 ? raw : String(n);
  const rounded = Math.round(n * 1e6) / 1e6;
  return String(rounded).replace('.', ',');
}

export function decodeXmlText(s: string): string {
  return s
    .replace(/_x([0-9a-fA-F]{4})_/g, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** "AB12" → 27 (índice 0). */
export function columnIndex(ref: string): number {
  const letters = (ref.match(/^[A-Z]+/i)?.[0] || '').toUpperCase();
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

type ZipEntry = { name: string; method: number; compSize: number; size: number; offset: number };

function u16(b: Uint8Array, o: number) {
  return b[o] | (b[o + 1] << 8);
}
function u32(b: Uint8Array, o: number) {
  return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
}

function readZipDirectory(bytes: Uint8Array): Map<string, ZipEntry> {
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (u32(bytes, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new SpreadsheetError('Arquivo .xlsx inválido ou corrompido.');
  const count = u16(bytes, eocd + 10);
  let p = u32(bytes, eocd + 16);
  const entries = new Map<string, ZipEntry>();
  for (let i = 0; i < count; i++) {
    if (u32(bytes, p) !== 0x02014b50) throw new SpreadsheetError('Arquivo .xlsx inválido ou corrompido.');
    const method = u16(bytes, p + 10);
    const compSize = u32(bytes, p + 20);
    const size = u32(bytes, p + 24);
    const nameLen = u16(bytes, p + 28);
    const extraLen = u16(bytes, p + 30);
    const commentLen = u16(bytes, p + 32);
    const offset = u32(bytes, p + 42);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
    entries.set(name, { name, method, compSize, size, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const DS = (globalThis as { DecompressionStream?: typeof DecompressionStream }).DecompressionStream;
  if (!DS) throw new SpreadsheetError('Este navegador não abre .xlsx. Salve a planilha como CSV e envie de novo.');
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DS('deflate-raw' as CompressionFormat));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readZipText(bytes: Uint8Array, entries: Map<string, ZipEntry>, name: string): Promise<string | null> {
  const e = entries.get(name);
  if (!e) return null;
  if (e.size > XLSX_MAX_ENTRY_BYTES) throw new SpreadsheetError('Planilha grande demais. Divida em arquivos menores.');
  if (u32(bytes, e.offset) !== 0x04034b50) throw new SpreadsheetError('Arquivo .xlsx inválido ou corrompido.');
  const start = e.offset + 30 + u16(bytes, e.offset + 26) + u16(bytes, e.offset + 28);
  const raw = bytes.subarray(start, start + e.compSize);
  let out: Uint8Array;
  if (e.method === 0) out = raw;
  else if (e.method === 8) out = await inflateRaw(raw);
  else throw new SpreadsheetError('Formato de compactação do .xlsx não suportado. Salve como CSV.');
  if (out.length > XLSX_MAX_ENTRY_BYTES) throw new SpreadsheetError('Planilha grande demais. Divida em arquivos menores.');
  return new TextDecoder().decode(out);
}

function attr(attrs: string, name: string): string | null {
  const m = attrs.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`));
  return m ? m[1] : null;
}

function joinTextRuns(xml: string): string {
  let out = '';
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g;
  let m: RegExpExecArray | null;
  const noPhonetic = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
  while ((m = re.exec(noPhonetic))) out += decodeXmlText(m[1] ?? '');
  return out;
}

export function parseSharedStrings(xml: string | null): string[] {
  if (!xml) return [];
  const out: string[] = [];
  const re = /<si>([\s\S]*?)<\/si>|<si\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(joinTextRuns(m[1] ?? ''));
  return out;
}

export function parseSheetXml(xml: string, shared: string[]): Matrix {
  const rows: Matrix = [];
  const rowRe = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
  let rm: RegExpExecArray | null;
  let nextRow = 0;
  while ((rm = rowRe.exec(xml))) {
    const rAttr = attr(rm[1], 'r');
    const rowIdx = rAttr ? Number(rAttr) - 1 : nextRow;
    nextRow = rowIdx + 1;
    const cells: string[] = [];
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm: RegExpExecArray | null;
    let nextCol = 0;
    const body = rm[2] || '';
    while ((cm = cellRe.exec(body))) {
      const ref = attr(cm[1], 'r');
      const col = ref ? columnIndex(ref) : nextCol;
      nextCol = col + 1;
      const type = attr(cm[1], 't') || 'n';
      const inner = cm[2] || '';
      const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let text = '';
      if (type === 's') text = v != null ? shared[Number(v)] ?? '' : '';
      else if (type === 'inlineStr') text = joinTextRuns(inner.match(/<is>([\s\S]*?)<\/is>/)?.[1] || '');
      else if (type === 'b') text = v === '1' ? 'sim' : v === '0' ? 'não' : '';
      else if (type === 'str') text = decodeXmlText(v ?? '');
      else if (type === 'e') text = decodeXmlText(v ?? ''); // ex.: #NOME? — o usuário vê o erro da fórmula
      else text = v != null && v.trim() ? xlsxNumberToText(decodeXmlText(v)) : '';
      while (cells.length < col) cells.push('');
      cells[col] = text;
    }
    while (rows.length < rowIdx) rows.push([]);
    rows[rowIdx] = cells;
  }
  return trimMatrix(rows);
}

function resolveTarget(target: string): string {
  const t = target.replace(/^\//, '');
  return t.startsWith('xl/') ? t : `xl/${t}`;
}

/** Primeira aba do .xlsx → matriz de textos. */
export async function readXlsxMatrix(bytes: Uint8Array): Promise<Matrix> {
  if (!looksLikeZip(bytes)) throw new SpreadsheetError('O arquivo não é um .xlsx válido. Salve como Excel (.xlsx) ou CSV.');
  const entries = readZipDirectory(bytes);
  let sheetPath = 'xl/worksheets/sheet1.xml';
  const workbook = await readZipText(bytes, entries, 'xl/workbook.xml');
  const rels = await readZipText(bytes, entries, 'xl/_rels/workbook.xml.rels');
  if (workbook && rels) {
    const firstSheet = workbook.match(/<sheet\b[^>]*>/)?.[0] || '';
    const rid = firstSheet.match(/r:id="([^"]+)"/)?.[1];
    if (rid) {
      const rel = rels.match(new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*>`))?.[0] || '';
      const target = rel.match(/Target="([^"]+)"/)?.[1];
      if (target) sheetPath = resolveTarget(target);
    }
  }
  const sheet = await readZipText(bytes, entries, sheetPath);
  if (!sheet) throw new SpreadsheetError('Não achei a primeira aba da planilha.');
  const shared = parseSharedStrings(await readZipText(bytes, entries, 'xl/sharedStrings.xml'));
  return parseSheetXml(sheet, shared);
}

/** Arquivo escolhido (.csv ou .xlsx) → matriz. */
export async function readSpreadsheetFile(file: { name: string; size: number; arrayBuffer(): Promise<ArrayBuffer> }): Promise<Matrix> {
  if (file.size > SPREADSHEET_MAX_BYTES) {
    throw new SpreadsheetError('Arquivo grande demais (máx. 5 MB). Divida a planilha.');
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (isXlsxFileName(file.name) || looksLikeZip(bytes)) return readXlsxMatrix(bytes);
  if (/\.xls$/i.test(file.name)) {
    throw new SpreadsheetError('Formato .xls antigo não é aceito. No Excel use “Salvar como” → Pasta de Trabalho do Excel (.xlsx) ou CSV.');
  }
  return parseCsvMatrix(decodeCsvBytes(bytes));
}

/** Excel no Windows costuma salvar CSV em ANSI (Windows-1252); UTF-8 inválido cai para ele. */
export function decodeCsvBytes(bytes: Uint8Array): string {
  const utf8 = new TextDecoder('utf-8').decode(bytes);
  if (!utf8.includes('\uFFFD')) return utf8;
  try {
    return new TextDecoder('windows-1252').decode(bytes);
  } catch {
    return utf8;
  }
}
