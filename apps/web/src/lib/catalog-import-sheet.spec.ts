/**
 * Importação por planilha no /admin: leitura de .xlsx/.csv no navegador,
 * troca de nomes de foto por links e os modelos commitados em public/modelos.
 */
import assert from 'assert';
import { readFileSync } from 'fs';
import { inflateRawSync } from 'zlib';
import { join } from 'path';
import {
  decodeCsvBytes,
  matrixToCsv,
  parseCsvMatrix,
  readSpreadsheetFile,
  readXlsxMatrix,
  xlsxNumberToText,
} from './spreadsheet-read';
import {
  CATALOG_IMPORT_COLUMNS,
  CATALOG_IMPORT_TEMPLATE,
  buildPhotoMap,
  importSummaryText,
  resolvePhotoNames,
  splitPhotoCell,
} from './catalog-import-ui';
import { buildTemplateCsv, buildTemplateXlsx } from '../../scripts/gerar-modelo-importacao';

const root = join(__dirname, '..', '..');
/** Conteúdo descompactado de cada arquivo do zip (o deflate muda conforme a versão do zlib). */
function unzipEntries(buf: Buffer): Record<string, string> {
  const out: Record<string, string> = {};
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < buf.readUInt16LE(eocd + 10); i++) {
    const method = buf.readUInt16LE(p + 10);
    const comp = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    const off = buf.readUInt32LE(p + 42);
    const start = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28);
    const raw = buf.subarray(start, start + comp);
    out[name] = (method === 8 ? inflateRawSync(raw) : raw).toString('utf8');
    p += 46 + nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return out;
}

const fixture = (name: string) => new Uint8Array(readFileSync(join(__dirname, '__fixtures__', name)));

async function main() {
  {
    // Colunas do web = colunas da API (mesma ordem).
    const api = readFileSync(join(root, '..', 'api', 'src', 'modules', 'admin', 'catalog-csv.ts'), 'utf8');
    const block = api.match(/CATALOG_TEMPLATE_COLUMNS = \[([\s\S]*?)\] as const/)?.[1] || '';
    const apiCols = Array.from(block.matchAll(/'([a-z_]+)'/g)).map((m) => m[1]);
    assert.deepEqual(apiCols, [...CATALOG_IMPORT_COLUMNS]);
    assert.equal(CATALOG_IMPORT_TEMPLATE, `${CATALOG_IMPORT_COLUMNS.join(';')}\n`);
    console.log('catalog-import-sheet: colunas web = API — PASSOU');
  }

  {
    // Modelos commitados = saída do gerador (ninguém editou o binário à mão).
    const xlsx = readFileSync(join(root, 'public', 'modelos', 'modelo-importacao-produtos.xlsx'));
    assert.deepEqual(unzipEntries(xlsx), unzipEntries(buildTemplateXlsx()), 'rode scripts/gerar-modelo-importacao.ts');
    const csv = readFileSync(join(root, 'public', 'modelos', 'modelo-importacao-produtos.csv'), 'utf8');
    assert.equal(csv, buildTemplateCsv());
    const rows = await readXlsxMatrix(new Uint8Array(xlsx));
    assert.deepEqual(rows[0], [...CATALOG_IMPORT_COLUMNS]);
    assert.equal(rows[1][0], 'EXEMPLO-001');
    assert.equal(rows[1][4], '3499,9', 'decimal do Excel vira vírgula');
    assert.equal(rows[1][8], '62,5');
    assert.equal(rows[2][5] ?? '', '', 'preco_de vazio');
    const fromCsv = parseCsvMatrix(csv);
    assert.deepEqual(fromCsv[0], [...CATALOG_IMPORT_COLUMNS]);
    assert.deepEqual(fromCsv[1], rows[1]);
    assert.equal(fromCsv[2][2], 'Tela de 6,5", 128 GB, câmera dupla. Acompanha carregador.');
    console.log('catalog-import-sheet: modelos .xlsx/.csv — PASSOU');
  }

  for (const name of ['planilha-openpyxl.xlsx', 'planilha-libreoffice.xlsx']) {
    // Arquivos salvos por outros programas (shared strings, booleanos, 2 abas).
    const rows = await readXlsxMatrix(fixture(name));
    assert.deepEqual(rows[0], ['sku', 'nome', 'preco', 'preco_de', 'estoque', 'ativo', 'fotos'], name);
    assert.deepEqual(rows[1], ['00123', 'Fogão 4 bocas & forno', '899,9', '', '3', 'sim', 'fogao.jpg'], name);
    assert.equal(rows[2][0], '7891234567890', `${name}: SKU numérico sem notação científica`);
    assert.equal(rows[2][2], '1299,5');
    assert.equal(rows[2][5], 'não');
    assert.ok(!rows.flat().includes('x'), `${name}: só a primeira aba`);
    if (name.includes('libreoffice')) assert.equal(rows[3][1], '#NAME?', 'erro de fórmula aparece');
    else assert.ok(!rows[3] || rows[3].every((c) => c === ''), 'fórmula sem valor salvo fica vazia');
    console.log(`catalog-import-sheet: ${name} — PASSOU`);
  }

  {
    const file = (name: string, bytes: Uint8Array) => ({
      name,
      size: bytes.length,
      arrayBuffer: async () => bytes.slice().buffer as ArrayBuffer,
    });
    const rows = await readSpreadsheetFile(file('produtos.xlsx', fixture('planilha-openpyxl.xlsx')));
    assert.equal(rows[1][1], 'Fogão 4 bocas & forno');
    await assert.rejects(readSpreadsheetFile(file('velho.xls', new Uint8Array([1, 2, 3]))), /\.xls antigo/);
    await assert.rejects(
      readSpreadsheetFile({ name: 'x.csv', size: 6 * 1024 * 1024, arrayBuffer: async () => new ArrayBuffer(0) }),
      /grande demais/,
    );
    await assert.rejects(readXlsxMatrix(new Uint8Array([0x50, 0x4b, 3, 4, 0, 0])), /inválido|corrompido/);
    console.log('catalog-import-sheet: readSpreadsheetFile — PASSOU');
  }

  {
    // CSV: ; e , / aspas / CRLF / BOM / ANSI do Excel.
    assert.deepEqual(parseCsvMatrix('\uFEFFsku;nome\r\nA-1;"Tela 6,5"" ; preta"\r\n'), [
      ['sku', 'nome'],
      ['A-1', 'Tela 6,5" ; preta'],
    ]);
    assert.deepEqual(parseCsvMatrix('sku,nome,preco\nA-1,"Fogão, 4 bocas","1.299,90"\n\n'), [
      ['sku', 'nome', 'preco'],
      ['A-1', 'Fogão, 4 bocas', '1.299,90'],
    ]);
    const ansi = new Uint8Array([0x73, 0x6b, 0x75, 0x3b, 0x6e, 0x6f, 0x6d, 0x65, 0x0a, 0x41, 0x3b, 0x46, 0x6f, 0x67, 0xe3, 0x6f]);
    assert.equal(decodeCsvBytes(ansi), 'sku;nome\nA;Fogão');
    assert.equal(matrixToCsv([['sku', 'nome'], ['A', 'x;y'], ['B', 'diz "oi"']]), 'sku;nome\nA;"x;y"\nB;"diz ""oi"""\n');
    assert.equal(xlsxNumberToText('24.899999999999999'), '24,9');
    assert.equal(xlsxNumberToText('1500'), '1500');
    console.log('catalog-import-sheet: CSV — PASSOU');
  }

  {
    // Fotos por nome de arquivo → links enviados no painel.
    assert.deepEqual(splitPhotoCell('a.jpg, b.jpg|https://x.example/c,d.jpg'), ['a.jpg', 'b.jpg', 'https://x.example/c,d.jpg']);
    const map = buildPhotoMap([
      { name: 'Geladeira-Frente.JPG', url: 'https://lojasschimitz.com.br/api/v1/uploads/1.jpg' },
      { name: 'geladeira-aberta.jpg', url: 'https://lojasschimitz.com.br/api/v1/uploads/2.jpg' },
    ]);
    const out = resolvePhotoNames(
      [
        ['sku', 'nome', 'Fotos'],
        ['A', 'Geladeira', 'geladeira-frente.jpg|C:\\fotos\\geladeira-aberta.jpg'],
        ['B', 'Fogão', 'fogao.jpg'],
        ['C', 'Link', 'https://cdn.example/x.jpg'],
        ['D', 'Sem extensão', 'geladeira-frente'],
      ],
      map,
    );
    assert.equal(out.rows[1][2], 'https://lojasschimitz.com.br/api/v1/uploads/1.jpg|https://lojasschimitz.com.br/api/v1/uploads/2.jpg');
    assert.equal(out.rows[2][2], 'fogao.jpg');
    assert.equal(out.rows[3][2], 'https://cdn.example/x.jpg');
    assert.equal(out.rows[4][2], 'https://lojasschimitz.com.br/api/v1/uploads/1.jpg');
    assert.deepEqual(out.missing, ['fogao.jpg']);
    assert.equal(out.replaced, 3);
    assert.equal(importSummaryText({ toCreate: 2, toUpdate: 1, failed: 0 }), '2 produto(s) novo(s) · 1 atualização(ões) · 0 linha(s) com erro');
    console.log('catalog-import-sheet: fotos por nome — PASSOU');
  }

  {
    // Painel: pré-visualiza antes de gravar, aceita .xlsx e envia fotos.
    const panel = readFileSync(join(__dirname, '..', 'components', 'admin', 'sections', 'AdminCatalogImportPanel.tsx'), 'utf8');
    assert.ok(panel.includes('Importar planilha'));
    assert.ok(panel.includes('dryRun: true'), 'confere antes de gravar');
    assert.ok(panel.includes('dryRun: false'));
    assert.ok(panel.includes('readSpreadsheetFile'));
    assert.ok(panel.includes('.xlsx'));
    assert.ok(panel.includes('Enviar fotos'));
    assert.ok(panel.includes("'/admin/uploads'"));
    assert.ok(panel.includes('create_only'));
    assert.ok(panel.includes('CATALOG_TEMPLATE_XLSX_URL'));
    console.log('catalog-import-sheet: painel — PASSOU');
  }

  console.log('catalog-import-sheet.spec ok');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
