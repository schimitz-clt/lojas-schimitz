/**
 * Gera os modelos de planilha para importar produtos no /admin:
 *   public/modelos/modelo-importacao-produtos.xlsx  (abas "Produtos" e "Instruções")
 *   public/modelos/modelo-importacao-produtos.csv   (UTF-8 com BOM, separador ;)
 * Rodar: npx --yes tsx scripts/gerar-modelo-importacao.ts  (dentro de apps/web)
 * Saída determinística (data fixa no zip) — o spec confere que o arquivo do repo bate.
 */
import { writeFileSync } from 'fs';
import { join } from 'path';
import { crc32, deflateRawSync } from 'zlib';
import { CATALOG_IMPORT_COLUMNS } from '../src/lib/catalog-import-ui';

type Cell = string | number | null;

export const TEMPLATE_EXAMPLE_ROWS: Cell[][] = [
  [
    'EXEMPLO-001',
    'Geladeira Frost Free 375 L Inox',
    'Geladeira duplex frost free, 375 litros, 220 V. Garantia de 1 ano do fabricante.',
    'eletrodomesticos',
    3499.9,
    3999.9,
    4,
    'sim',
    62.5,
    70,
    180,
    72,
    'geladeira-frente.jpg|geladeira-aberta.jpg',
  ],
  [
    'EXEMPLO-002',
    'Smartphone 128 GB Preto',
    'Tela de 6,5", 128 GB, câmera dupla. Acompanha carregador.',
    'celulares',
    1299,
    null,
    10,
    'sim',
    0.4,
    12,
    6,
    18,
    'https://exemplo-do-fornecedor.com.br/fotos/smartphone-preto.jpg',
  ],
];

export const TEMPLATE_INSTRUCTIONS: string[][] = [
  ['Coluna', 'Obrigatória?', 'O que colocar', 'Exemplo'],
  ['sku', 'Sim, sempre', 'Código único do produto (seu código interno ou o código de barras). É por ele que o sistema sabe se o produto já existe: mesmo SKU = atualiza, SKU novo = cria.', 'GEL-375-INOX'],
  ['nome', 'Sim, para produto novo', 'Nome que aparece na loja (2 a 160 letras).', 'Geladeira Frost Free 375 L Inox'],
  ['descricao', 'Não', 'Texto da página do produto (até 4000 letras).', 'Geladeira duplex, 220 V…'],
  ['categoria', 'Recomendado', 'Nome ou código de uma categoria que já existe no site: eletro, celulares, informatica, eletrodomesticos, casa, esporte, eletronicos, utilidades, ferramentas, beleza, moda.', 'eletrodomesticos'],
  ['preco', 'Sim, para produto novo', 'Preço de venda em reais. Pode usar vírgula: 3499,90 ou 3.499,90.', '3499,90'],
  ['preco_de', 'Não', 'Preço “de” (riscado). Só aparece em Ofertas se for MAIOR que o preço. Deixe vazio se não tiver.', '3999,90'],
  ['estoque', 'Recomendado', 'Quantidade em estoque (número inteiro). Vazio em produto novo = 0 (não dá para comprar).', '4'],
  ['ativo', 'Não', '“sim” = aparece na loja; “não” = fica escondido. Vazio em produto novo = sim.', 'sim'],
  ['peso_kg', 'Recomendado', 'Peso da caixa embalada, em kg. Usado no frete (Melhor Envio). Sem peso o frete usa 0,3 kg.', '62,5'],
  ['largura_cm', 'Recomendado', 'Largura da caixa embalada, em cm.', '70'],
  ['altura_cm', 'Recomendado', 'Altura da caixa embalada, em cm.', '180'],
  ['comprimento_cm', 'Recomendado', 'Comprimento (profundidade) da caixa embalada, em cm.', '72'],
  ['fotos', 'Não', 'Nomes dos arquivos de foto que você vai enviar no botão “Enviar fotos” (ex.: geladeira-frente.jpg) ou links https://. Várias fotos: separe com | . Até 10 por produto. A primeira é a capa.', 'geladeira-frente.jpg|geladeira-aberta.jpg'],
  ['', '', '', ''],
  ['Dicas', '', '', ''],
  ['1', '', 'Apague as linhas EXEMPLO-001 e EXEMPLO-002 da aba Produtos (se esquecer, o sistema recusa essas linhas).', ''],
  ['2', '', 'Não mude os nomes das colunas da primeira linha. Colunas fora desta lista são ignoradas.', ''],
  ['3', '', 'Célula vazia não apaga o que já está salvo. Para corrigir só o preço de um produto, basta preencher sku e preco.', ''],
  ['4', '', 'Máximo de 500 produtos por planilha. Se tiver mais, divida em arquivos.', ''],
  ['5', '', 'A importação nunca apaga produtos nem fotos.', ''],
];

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function colName(i: number): string {
  let n = i + 1;
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function cellXml(ref: string, value: Cell, style: number): string {
  const s = style ? ` s="${style}"` : '';
  if (value == null || value === '') return style ? `<c r="${ref}"${s}/>` : '';
  if (typeof value === 'number') return `<c r="${ref}"${s}><v>${value}</v></c>`;
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
}

function sheetXml(rows: Cell[][], widths: number[], opts: { headerStyle: number; colStyle?: Record<number, number>; wrap?: boolean }): string {
  const cols = widths
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"${opts.colStyle?.[i] ? ` style="${opts.colStyle[i]}"` : ''}/>`)
    .join('');
  const body = rows
    .map((row, r) => {
      const cells = row
        .map((v, c) => cellXml(`${colName(c)}${r + 1}`, v, r === 0 ? opts.headerStyle : opts.colStyle?.[c] ?? (opts.wrap ? 3 : 0)))
        .join('');
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    `<cols>${cols}</cols><sheetData>${body}</sheetData></worksheet>`
  );
}

const CONTENT_TYPES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
  '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
  '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
  '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
  '</Types>';

const ROOT_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
  '</Relationships>';

const WORKBOOK =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
  '<sheets><sheet name="Produtos" sheetId="1" r:id="rId1"/><sheet name="Instruções" sheetId="2" r:id="rId2"/></sheets></workbook>';

const WORKBOOK_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>' +
  '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
  '</Relationships>';

// 0 padrão · 1 cabeçalho (negrito, fundo amarelo) · 2 texto (@, para SKU não perder zeros) · 3 quebra de linha
const STYLES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFFFE699"/><bgColor indexed="64"/></patternFill></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
  '<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf></cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

/** ZIP mínimo (deflate) com data fixa → bytes iguais a cada geração. */
export function buildZip(files: { name: string; data: string }[]): Buffer {
  const DOS_TIME = 0; // 00:00:00
  const DOS_DATE = ((2026 - 1980) << 9) | (10 << 5) | 9; // 2026-10-09
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8');
    const raw = Buffer.from(f.data, 'utf8');
    const comp = deflateRawSync(raw, { level: 9 });
    const crc = crc32(raw) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, comp);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(comp.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += 30 + name.length + comp.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, end]);
}

export function buildTemplateXlsx(): Buffer {
  const header: Cell[] = [...CATALOG_IMPORT_COLUMNS];
  const produtos = sheetXml([header, ...TEMPLATE_EXAMPLE_ROWS], [16, 34, 50, 18, 12, 12, 10, 8, 10, 12, 11, 15, 50], {
    headerStyle: 1,
    colStyle: { 0: 2 },
  });
  const instrucoes = sheetXml(TEMPLATE_INSTRUCTIONS, [16, 22, 90, 36], { headerStyle: 1, wrap: true });
  return buildZip([
    { name: '[Content_Types].xml', data: CONTENT_TYPES },
    { name: '_rels/.rels', data: ROOT_RELS },
    { name: 'xl/workbook.xml', data: WORKBOOK },
    { name: 'xl/_rels/workbook.xml.rels', data: WORKBOOK_RELS },
    { name: 'xl/styles.xml', data: STYLES },
    { name: 'xl/worksheets/sheet1.xml', data: produtos },
    { name: 'xl/worksheets/sheet2.xml', data: instrucoes },
  ]);
}

function csvCell(v: Cell): string {
  if (v == null) return '';
  const s = typeof v === 'number' ? String(v).replace('.', ',') : v;
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildTemplateCsv(): string {
  const lines = [[...CATALOG_IMPORT_COLUMNS] as Cell[], ...TEMPLATE_EXAMPLE_ROWS].map((r) => r.map(csvCell).join(';'));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

if (require.main === module) {
  const dir = join(__dirname, '..', 'public', 'modelos');
  writeFileSync(join(dir, 'modelo-importacao-produtos.xlsx'), buildTemplateXlsx());
  writeFileSync(join(dir, 'modelo-importacao-produtos.csv'), buildTemplateCsv(), 'utf8');
  console.log('modelos gerados em public/modelos');
}
