/** Painel executivo: período (hoje / 7 dias / 30 dias) sobre janelas reais do resumo. Nada estimado. */
export type ExecPeriod = 'hoje' | '7d' | '30d';
export const EXEC_PERIODS: { id: ExecPeriod; label: string }[] = [
  { id: 'hoje', label: 'Hoje' },
  { id: '7d', label: '7 dias' },
  { id: '30d', label: '30 dias' },
];

export function parseExecPeriod(raw: string | null | undefined): ExecPeriod {
  return raw === '7d' || raw === '30d' ? raw : 'hoje';
}

type Win = { orderCount: number; revenue: number } | null | undefined;
export type ExecSales = { today?: Win; last7d?: Win; last30d?: Win } | null | undefined;

export type ExecWindow = { revenue: number; orders: number; ticket: number | null };

/** null = a janela não veio (mostra "sem dados ainda"); zero continua zero. */
export function execWindow(sales: ExecSales, period: ExecPeriod): ExecWindow | null {
  const w = period === 'hoje' ? sales?.today : period === '7d' ? sales?.last7d : sales?.last30d;
  if (!w || !Number.isFinite(Number(w.revenue)) || !Number.isFinite(Number(w.orderCount))) return null;
  const orders = Math.max(0, Math.trunc(Number(w.orderCount)));
  const revenue = Number(w.revenue);
  return { revenue, orders, ticket: orders > 0 ? Math.round((revenue / orders) * 100) / 100 : null };
}

export function execPeriodLabel(p: ExecPeriod): string {
  return p === 'hoje' ? 'hoje' : p === '7d' ? 'nos últimos 7 dias' : 'nos últimos 30 dias';
}

/** Lista de prioridades: mais grave primeiro, depois maior contagem. Só alertas reais do resumo. */
export type ExecSeverity = 'info' | 'warn' | 'high' | 'critical';
const SEV_RANK: Record<ExecSeverity, number> = { critical: 0, high: 1, warn: 2, info: 3 };
export function execSeverityLabel(s: ExecSeverity): string {
  return s === 'critical' ? 'Crítico' : s === 'high' ? 'Alto' : s === 'warn' ? 'Atenção' : 'Aviso';
}
export function execPriorityList<T extends { severity: ExecSeverity; count?: number | null; code: string }>(
  alerts: T[] | null | undefined,
  max = 6,
): { items: T[]; hidden: number } {
  const sorted = [...(alerts ?? [])].sort(
    (a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || (b.count ?? 0) - (a.count ?? 0) || a.code.localeCompare(b.code),
  );
  return { items: sorted.slice(0, max), hidden: Math.max(0, sorted.length - max) };
}

/** Saúde da loja: número real ou "—" quando o resumo não trouxe. */
export function execHealthValue(n: number | null | undefined): string {
  return n == null || !Number.isFinite(n) ? '—' : String(n);
}

/** Texto do alerta para o dono da loja: substitui mensagens técnicas (variáveis, caminhos) por português simples. */
const PLAIN_ALERT_COPY: Record<string, (count: number | null | undefined) => { message: string; action: string }> = {
  uploads_ephemeral: () => ({
    message: 'As fotos enviadas ficam num armazenamento temporário e podem sumir numa atualização do sistema',
    action: 'Peça ao responsável técnico para ativar o armazenamento permanente de fotos.',
  }),
  products_missing_shipping_data: (n) => ({
    message: `${n ?? 0} produto(s) sem peso ou medidas — o frete está usando um tamanho padrão`,
    action: 'No Catálogo, baixe a lista de produtos sem peso/medidas e preencha os valores reais.',
  }),
  mail_off_with_store_notify: () => ({
    message: 'O aviso de venda por e-mail está desligado',
    action: 'Peça ao responsável técnico para configurar o envio de e-mails. Os pagamentos não são afetados.',
  }),
  mail_not_configured: () => ({
    message: 'O envio de e-mails da loja não está configurado',
    action: 'Peça ao responsável técnico para configurar o envio de e-mails.',
  }),
};
export function execAlertCopy(a: { code: string; message: string; recommendedAction?: string | null; count?: number | null }): {
  message: string;
  action: string | null;
} {
  const f = PLAIN_ALERT_COPY[a.code];
  return f ? f(a.count) : { message: a.message, action: a.recommendedAction ?? null };
}
