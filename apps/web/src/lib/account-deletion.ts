/**
 * Página pública /excluir-conta (exigência do Google Play + LGPD art. 18).
 * O texto espelha o que a API faz em apps/api/src/modules/account-deletion.
 */
import { DEFAULT_STORE_WHATSAPP } from './whatsapp';

export const ACCOUNT_DELETION_PATH = '/excluir-conta';
export const ACCOUNT_DELETION_API = '/me/account-deletion';
/** Mesmo valor de DELETION_SLA_DAYS na API. */
export const ACCOUNT_DELETION_SLA_DAYS = 15;
export const ACCOUNT_DELETION_REASON_MAX = 300;
/** Prazo de guarda de pedidos/pagamentos informado ao cliente (igual à /privacidade). */
export const ACCOUNT_DELETION_ORDER_RETENTION = '5 anos depois da compra';

export const ACCOUNT_DELETION_SEO = {
  title: 'Excluir conta',
  description:
    'Como pedir a exclusão da sua conta na Lojas Schimitz (site e app Android), o que é apagado, o que é mantido e por quanto tempo.',
  path: ACCOUNT_DELETION_PATH,
} as const;

export const ACCOUNT_DELETION_STEPS = [
  'Entre na sua conta no site lojasschimitz.com.br ou no app Android da Lojas Schimitz.',
  'Abra esta página (Minha conta → Ajuda → Excluir conta, ou o link "Excluir conta" no rodapé).',
  'Marque a confirmação e toque em "Pedir exclusão da conta". Se quiser, conte o motivo.',
  `A loja processa o pedido em até ${ACCOUNT_DELETION_SLA_DAYS} dias. Enquanto não for processado, você pode desistir nesta mesma página.`,
];

export const ACCOUNT_DELETION_DELETED = [
  'Nome, e-mail, telefone/WhatsApp, CPF e data de nascimento (a conta é anonimizada e não pode mais entrar).',
  'Senha e todas as sessões abertas (você sai de todos os aparelhos).',
  'Endereços salvos, favoritos (Salvos) e carrinho.',
  'Notificações da conta, token de notificação do app e produtos vistos registrados para notificações.',
  'Avaliações de produtos que você publicou (a nota média do produto é recalculada).',
];

export const ACCOUNT_DELETION_KEPT = [
  `Pedidos, pagamentos, estornos e o endereço de entrega usado em cada pedido: guardados por ${ACCOUNT_DELETION_ORDER_RETENTION} para cumprir obrigações legais, fiscais e de defesa do consumidor (art. 16 da LGPD). Ficam ligados a uma conta anonimizada.`,
  'Histórico de cashback (SCHIMITZ+) e registros de auditoria das operações financeiras, pelo mesmo prazo. Saldo de cashback não usado é perdido com a exclusão.',
  'Registros técnicos de acesso (IP, data e hora): pelo prazo de retenção do provedor de hospedagem e, quando a lei exigir, por pelo menos 6 meses.',
];

export const ACCOUNT_DELETION_NOTES = [
  'Se houver pedido em andamento (aguardando pagamento, pago, em separação ou a caminho), a exclusão é feita depois que ele for entregue ou cancelado.',
  'Desinstalar o app não exclui a conta. Dados guardados só no seu aparelho (carrinho de visitante, produtos vistos recentemente, conversa do chat) são apagados limpando os dados do navegador ou do app.',
  'Contas da equipe da loja (admin ou vendedor) não usam este fluxo: fale pelo WhatsApp.',
];

export function accountDeletionWhatsappHref(digits: string = DEFAULT_STORE_WHATSAPP): string {
  const text = 'Olá! Quero pedir a exclusão da minha conta na Lojas Schimitz. Meu e-mail de cadastro é: ';
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export type AccountDeletionStatus =
  | { status: 'none'; openOrders: number }
  | { status: 'pending'; requestedAt: string; slaDays: number; openOrders: number }
  | { status: 'processed'; processedAt: string; openOrders: number };

export function formatDeletionDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

/** Mensagem curta do estado para quem está logado. */
export function accountDeletionStatusCopy(s: AccountDeletionStatus): string {
  if (s.status === 'pending') {
    const when = formatDeletionDate(s.requestedAt);
    const base = `Pedido de exclusão recebido${when ? ` em ${when}` : ''}. A loja conclui em até ${s.slaDays} dias.`;
    return s.openOrders > 0
      ? `${base} Você tem ${s.openOrders} pedido(s) em andamento: a exclusão acontece depois que forem entregues ou cancelados.`
      : base;
  }
  if (s.status === 'processed') return 'Esta conta já foi excluída.';
  return s.openOrders > 0
    ? `Você tem ${s.openOrders} pedido(s) em andamento. Pode pedir a exclusão agora; ela é concluída depois que forem entregues ou cancelados.`
    : 'Sua conta está ativa. Ao pedir a exclusão, a loja apaga os dados listados abaixo.';
}

export function cleanDeletionReasonInput(raw: string): string | undefined {
  const v = raw.replace(/\s+/g, ' ').trim().slice(0, ACCOUNT_DELETION_REASON_MAX);
  return v || undefined;
}
