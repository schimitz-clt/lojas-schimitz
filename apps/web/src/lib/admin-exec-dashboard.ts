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
