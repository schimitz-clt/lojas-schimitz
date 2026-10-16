/**
 * Listas do admin: filtros na URL (sobrevivem a recarregar/compartilhar), ordenação e paginação.
 * Funções puras. Chaves curtas em português.
 */
export const ADMIN_PAGE_SIZE = 25;

export type ListParamKey = 'status' | 'busca' | 'ordem' | 'pagina' | 'filtro' | 'foto' | 'cliente_busca';

export function readListParam(search: URLSearchParams | null | undefined, key: ListParamKey): string {
  return String(search?.get(key) ?? '').trim();
}

/** Nova query preservando o resto. Valor vazio/padrão remove a chave. Mudar filtro volta à página 1. */
export function withListParams(
  search: URLSearchParams | string | null | undefined,
  patch: Partial<Record<ListParamKey, string | number | null | undefined>>,
): string {
  const q = new URLSearchParams(typeof search === 'string' ? search : search?.toString() || '');
  let resetPage = false;
  for (const [k, v] of Object.entries(patch)) {
    const val = v == null ? '' : String(v).trim();
    if (!val || (k === 'pagina' && val === '1')) q.delete(k);
    else q.set(k, val);
    if (k !== 'pagina') resetPage = true;
  }
  if (resetPage && !('pagina' in patch)) q.delete('pagina');
  const s = q.toString();
  return s ? `?${s}` : '';
}

export function parsePage(raw: string | null | undefined): number {
  const n = Number.parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export function paginate<T>(rows: T[], page: number, size = ADMIN_PAGE_SIZE) {
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const p = Math.min(Math.max(1, page), pages);
  const start = (p - 1) * size;
  return { rows: rows.slice(start, start + size), page: p, pages, total, from: total ? start + 1 : 0, to: Math.min(total, start + size) };
}

export type OrderSort = 'recentes' | 'antigos' | 'maior_valor' | 'menor_valor';
export const ORDER_SORTS: { id: OrderSort; label: string }[] = [
  { id: 'recentes', label: 'Mais recentes' },
  { id: 'antigos', label: 'Mais antigos' },
  { id: 'maior_valor', label: 'Maior valor' },
  { id: 'menor_valor', label: 'Menor valor' },
];
export function parseOrderSort(raw: string | null | undefined): OrderSort {
  return ORDER_SORTS.some((s) => s.id === raw) ? (raw as OrderSort) : 'recentes';
}
export function sortOrders<T extends { createdAt?: string | Date | null; total?: string | number | null }>(rows: T[], sort: OrderSort): T[] {
  const t = (r: T) => (r.createdAt ? new Date(r.createdAt).getTime() : 0);
  const v = (r: T) => Number(r.total ?? 0) || 0;
  const out = [...rows];
  if (sort === 'recentes') out.sort((a, b) => t(b) - t(a));
  if (sort === 'antigos') out.sort((a, b) => t(a) - t(b));
  if (sort === 'maior_valor') out.sort((a, b) => v(b) - v(a));
  if (sort === 'menor_valor') out.sort((a, b) => v(a) - v(b));
  return out;
}

export type ProductSort = 'nome' | 'estoque_baixo' | 'preco_maior' | 'preco_menor';
export const PRODUCT_SORTS: { id: ProductSort; label: string }[] = [
  { id: 'nome', label: 'Nome (A–Z)' },
  { id: 'estoque_baixo', label: 'Menor estoque' },
  { id: 'preco_maior', label: 'Maior preço' },
  { id: 'preco_menor', label: 'Menor preço' },
];
export function parseProductSort(raw: string | null | undefined): ProductSort {
  return PRODUCT_SORTS.some((s) => s.id === raw) ? (raw as ProductSort) : 'nome';
}
export function sortProducts<T extends { name: string; price?: string | number | null; inventory?: { qtyOnHand: number } | null }>(rows: T[], sort: ProductSort): T[] {
  const out = [...rows];
  const price = (r: T) => Number(r.price ?? 0) || 0;
  const stock = (r: T) => r.inventory?.qtyOnHand ?? 0;
  if (sort === 'nome') out.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  if (sort === 'estoque_baixo') out.sort((a, b) => stock(a) - stock(b));
  if (sort === 'preco_maior') out.sort((a, b) => price(b) - price(a));
  if (sort === 'preco_menor') out.sort((a, b) => price(a) - price(b));
  return out;
}

export function textMatch(hay: (string | null | undefined)[], q: string): boolean {
  const n = q.trim().toLowerCase();
  if (!n) return true;
  return hay.some((h) => String(h ?? '').toLowerCase().includes(n));
}
