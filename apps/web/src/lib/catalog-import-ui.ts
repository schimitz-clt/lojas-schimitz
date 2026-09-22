/** Client-side guards for the admin Importação panel. The API re-validates before any write. */

export const CATALOG_IMPORT_MAX_CHARS = 450_000;

export const CATALOG_IMPORT_TEMPLATE =
  'sku;nome;descricao;preco;preco_de;estoque;ativo;categoria;peso_kg;largura_cm;altura_cm;comprimento_cm;imagens\n';

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
