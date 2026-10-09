/** Painel Admin → Clientes → Pedidos de exclusão (GET/POST /admin/account-deletion-requests). */
export const ADMIN_ACCOUNT_DELETION_API = '/admin/account-deletion-requests';

export type AdminAccountDeletionRequest = {
  userId: string;
  name: string;
  email: string;
  requestedAt: string;
  reason: string | null;
  openOrders: number;
  cashbackBalance: number;
  blocker: string | null;
  blockerMessage: string | null;
};

export const ADMIN_ACCOUNT_DELETION_LEDE =
  'Clientes que pediram a exclusão pelo site/app. O prazo informado ao cliente é de 15 dias. "Excluir dados" apaga endereços, favoritos, carrinho, notificações, sessões, aparelhos de push, produtos vistos e avaliações, e anonimiza nome, e-mail, telefone, CPF e nascimento. Pedidos, pagamentos, cashback e auditoria são mantidos.';

export const ADMIN_ACCOUNT_DELETION_CONFIRM = (email: string) =>
  `Excluir os dados pessoais de ${email}? Não dá para desfazer. Pedidos e pagamentos ficam guardados.`;

export function adminAccountDeletionProcessPath(userId: string): string {
  return `${ADMIN_ACCOUNT_DELETION_API}/${encodeURIComponent(userId)}/process`;
}
