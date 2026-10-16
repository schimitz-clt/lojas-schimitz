/** Abas e arquivamento da lista de pedidos (espelha a regra do servidor; o servidor decide). */
export type OrderView = 'ativos' | 'encerrados' | 'arquivados';
export const ORDER_VIEWS: { id: OrderView; label: string; empty: string }[] = [
  { id: 'ativos', label: 'Ativos', empty: 'Nenhum pedido ativo.' },
  { id: 'encerrados', label: 'Cancelados/expirados', empty: 'Nenhum pedido cancelado, expirado ou estornado.' },
  { id: 'arquivados', label: 'Arquivados', empty: 'Nenhum pedido arquivado.' },
];
export function parseOrderView(raw: string | null | undefined): OrderView {
  return raw === 'encerrados' || raw === 'arquivados' ? raw : 'ativos';
}
const ARCHIVABLE = new Set(['cancelled', 'refunded', 'delivered']);
export function canArchiveOrder(o: { status: string; archivedAt?: string | null }): boolean {
  return !o.archivedAt && ARCHIVABLE.has(o.status);
}
export function archiveResultMessage(
  archive: boolean,
  applied: number,
  skipped: { publicId: string | null; reason: string }[],
): string {
  const verb = archive ? 'arquivado(s)' : 'desarquivado(s)';
  const head = `${applied} pedido(s) ${verb}.`;
  if (!skipped.length) return head;
  const list = skipped.slice(0, 3).map((s) => `${s.publicId ?? 'pedido'}: ${s.reason}`).join('; ');
  return `${head} ${skipped.length} não alterado(s) — ${list}${skipped.length > 3 ? '…' : ''}`;
}
