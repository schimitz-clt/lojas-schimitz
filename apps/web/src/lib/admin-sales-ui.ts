/**
 * Admin Ciclo B (P1) — Vendas export + chart geometry.
 * No network, no DOM. Serializes the existing GET /admin/reports/sales payload.
 */

export type SalesSummaryLike = {
  orderCount: number;
  revenue: number;
  averageTicket: number;
};

export type SalesDayLike = {
  date: string;
  orderCount: number;
  revenue: number;
};

export type SalesProductLike = {
  productId: string;
  name: string;
  qty: number;
  revenue: number;
};

export type SalesSellerLike = {
  sellerId: string | null;
  sellerName: string;
  orderCount: number;
  itemQty: number;
  revenue: number;
};

export type SalesPaymentMethodLike = {
  method: string;
  orderCount: number;
  revenue: number;
};

export type SalesReportLike = {
  from: string;
  to: string;
  timezone?: string;
  summary: SalesSummaryLike;
  byStatus?: Record<string, number>;
  byDay?: SalesDayLike[];
  bySeller?: SalesSellerLike[];
  topProducts?: SalesProductLike[];
  byPaymentMethod?: SalesPaymentMethodLike[];
};

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value);
  if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function formatSalesMoneyCsv(n: number): string {
  const v = Number.isFinite(Number(n)) ? Math.round((Number(n) + Number.EPSILON) * 100) / 100 : 0;
  return v.toFixed(2).replace('.', ',');
}

export function formatSalesDatePt(ymd: string): string {
  const m = DATE_RE.exec(String(ymd || '').trim());
  if (!m) return String(ymd || '');
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function salesExportFilename(from: string, to: string): string {
  const a = DATE_RE.test(from) ? from : 'inicio';
  const b = DATE_RE.test(to) ? to : 'fim';
  return `vendas-${a}_${b}.csv`;
}

export function salesPaymentMethodLabel(method: string): string {
  const m = String(method || '')
    .trim()
    .toLowerCase();
  if (m === 'pix') return 'PIX';
  if (m === 'card' || m === 'credit_card' || m === 'debit_card') return 'Cartão';
  if (m === 'boleto') return 'Boleto';
  if (m === 'wallet') return 'Carteira';
  return method || 'Outro';
}

export function salesPaymentMethodColor(method: string): string {
  const m = String(method || '')
    .trim()
    .toLowerCase();
  if (m === 'pix') return '#0f7a3a';
  if (m === 'card' || m === 'credit_card' || m === 'debit_card') return '#1d4ed8';
  if (m === 'boleto') return '#b45309';
  if (m === 'wallet') return '#6b7280';
  return '#0b0c0f';
}

function csvRow(cells: Array<string | number | null | undefined>): string {
  return cells.map(csvEscape).join(';');
}

function section(title: string, header: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const lines = [title, csvRow(header), ...rows.map(csvRow)];
  return lines.join('\n');
}

/** One UTF-8 CSV (semicolon, PT headers) covering every Vendas block. */
export function buildSalesReportCsv(
  report: SalesReportLike,
  statusLabel: (status: string) => string = (s) => s,
): string {
  const tz = report.timezone || 'America/Sao_Paulo';
  const parts: string[] = [
    section(
      'Resumo',
      ['Campo', 'Valor'],
      [
        ['Período de', formatSalesDatePt(report.from)],
        ['Período até', formatSalesDatePt(report.to)],
        ['Fuso', tz],
        ['Pedidos pagos', report.summary.orderCount],
        ['Receita', formatSalesMoneyCsv(report.summary.revenue)],
        ['Ticket médio', formatSalesMoneyCsv(report.summary.averageTicket)],
      ],
    ),
    section(
      'Por dia',
      ['Data', 'Pedidos', 'Receita'],
      (report.byDay || []).map((d) => [
        formatSalesDatePt(d.date),
        d.orderCount,
        formatSalesMoneyCsv(d.revenue),
      ]),
    ),
    section(
      'Por status',
      ['Status', 'Quantidade'],
      Object.entries(report.byStatus || {})
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
        .map(([st, count]) => [statusLabel(st), count]),
    ),
    section(
      'Mais vendidos',
      ['Produto', 'Quantidade', 'Receita'],
      (report.topProducts || []).map((p) => [p.name, p.qty, formatSalesMoneyCsv(p.revenue)]),
    ),
    section(
      'Por vendedor',
      ['Vendedor', 'Pedidos', 'Itens', 'Receita'],
      (report.bySeller || []).map((s) => [
        s.sellerName,
        s.orderCount,
        s.itemQty,
        formatSalesMoneyCsv(s.revenue),
      ]),
    ),
    section(
      'Por método de pagamento',
      ['Método', 'Pedidos', 'Receita'],
      (report.byPaymentMethod || []).map((p) => [
        salesPaymentMethodLabel(p.method),
        p.orderCount,
        formatSalesMoneyCsv(p.revenue),
      ]),
    ),
  ];
  return `${parts.join('\n\n')}\n`;
}

export function salesCsvWithBom(csv: string): string {
  return `\uFEFF${csv}`;
}

export function addDaysYmd(ymd: string, delta: number): string {
  const d = new Date(`${ymd}T12:00:00-03:00`);
  d.setUTCDate(d.getUTCDate() + delta);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function daySpanInclusive(from: string, to: string): number {
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || from > to) return 0;
  const a = new Date(`${from}T12:00:00-03:00`).getTime();
  const b = new Date(`${to}T12:00:00-03:00`).getTime();
  return Math.round((b - a) / 86400000) + 1;
}

const MAX_FILL_DAYS = 366;

/** Completes the period with zero days so time-series charts stay continuous. */
export function fillSalesDays(
  byDay: SalesDayLike[] | undefined,
  from: string,
  to: string,
): SalesDayLike[] {
  const source = [...(byDay || [])].sort((a, b) => a.date.localeCompare(b.date));
  const span = daySpanInclusive(from, to);
  if (!span || span > MAX_FILL_DAYS) return source;
  const map = new Map(source.map((d) => [d.date, d]));
  const out: SalesDayLike[] = [];
  let cur = from;
  while (cur <= to) {
    out.push(map.get(cur) || { date: cur, orderCount: 0, revenue: 0 });
    cur = addDaysYmd(cur, 1);
  }
  return out;
}

export function niceMax(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(n));
  const nrm = n / pow;
  const nice = nrm <= 1 ? 1 : nrm <= 2 ? 2 : nrm <= 5 ? 5 : 10;
  return nice * pow;
}

export function scaleLinear(
  value: number,
  min: number,
  max: number,
  outMin: number,
  outMax: number,
): number {
  if (max <= min) return (outMin + outMax) / 2;
  return outMin + ((value - min) / (max - min)) * (outMax - outMin);
}

export type ChartPoint = { x: number; y: number; value: number };

export type ChartPad = {
  width: number;
  height: number;
  padL: number;
  padR: number;
  padT: number;
  padB: number;
};

export function lineSeriesPoints(values: number[], box: ChartPad, yMax?: number): ChartPoint[] {
  const max = yMax ?? niceMax(Math.max(0, ...values));
  const innerW = Math.max(1, box.width - box.padL - box.padR);
  const innerH = Math.max(1, box.height - box.padT - box.padB);
  if (!values.length) return [];
  return values.map((v, i) => ({
    x: box.padL + (values.length === 1 ? innerW / 2 : (i / (values.length - 1)) * innerW),
    y: box.padT + innerH - scaleLinear(Math.max(0, v), 0, max, 0, innerH),
    value: v,
  }));
}

export function polylinePath(points: ChartPoint[]): string {
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ');
}

export function areaPath(points: ChartPoint[], baselineY: number): string {
  if (!points.length) return '';
  const last = points[points.length - 1];
  const first = points[0];
  return `${polylinePath(points)} L${last.x.toFixed(2)},${baselineY.toFixed(2)} L${first.x.toFixed(2)},${baselineY.toFixed(2)} Z`;
}

export type BarRect = { x: number; y: number; w: number; h: number; value: number };

export function barRects(values: number[], box: ChartPad, yMax?: number, gap = 3): BarRect[] {
  const max = yMax ?? niceMax(Math.max(0, ...values));
  const innerW = Math.max(1, box.width - box.padL - box.padR);
  const innerH = Math.max(1, box.height - box.padT - box.padB);
  if (!values.length) return [];
  const slot = innerW / values.length;
  const w = Math.max(1, slot - gap);
  return values.map((v, i) => {
    const h = scaleLinear(Math.max(0, v), 0, max, 0, innerH);
    return {
      x: box.padL + i * slot + gap / 2,
      y: box.padT + innerH - h,
      w,
      h,
      value: v,
    };
  });
}

export type HBarRect = { x: number; y: number; w: number; h: number; value: number; index: number };

export function hBarRects(
  values: number[],
  opts: { width: number; barH: number; gap: number; padL: number; padR: number },
): HBarRect[] {
  const max = niceMax(Math.max(0, ...values));
  const innerW = Math.max(1, opts.width - opts.padL - opts.padR);
  return values.map((v, i) => ({
    x: opts.padL,
    y: i * (opts.barH + opts.gap),
    w: scaleLinear(Math.max(0, v), 0, max, 0, innerW),
    h: opts.barH,
    value: v,
    index: i,
  }));
}

export function pickTickIndexes(length: number, maxTicks: number): number[] {
  if (length <= 0) return [];
  if (maxTicks <= 1) return [0];
  if (length <= maxTicks) return Array.from({ length }, (_, i) => i);
  const out = new Set<number>();
  for (let i = 0; i < maxTicks; i++) {
    out.add(Math.round((i / (maxTicks - 1)) * (length - 1)));
  }
  return [...out].sort((a, b) => a - b);
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

export type DonutSlice = {
  d: string;
  value: number;
  pct: number;
  start: number;
  end: number;
};

export function donutSlices(
  values: number[],
  opts: { cx: number; cy: number; r: number; innerR: number },
): DonutSlice[] {
  const total = values.reduce((s, v) => s + Math.max(0, v), 0);
  if (total <= 0) return [];
  let angle = 0;
  return values.map((raw) => {
    const value = Math.max(0, raw);
    const sweep = (value / total) * 360;
    const start = angle;
    const end = angle + sweep;
    angle = end;
    const large = sweep > 180 ? 1 : 0;
    const o1 = polar(opts.cx, opts.cy, opts.r, start);
    const o2 = polar(opts.cx, opts.cy, opts.r, end);
    const i1 = polar(opts.cx, opts.cy, opts.innerR, end);
    const i2 = polar(opts.cx, opts.cy, opts.innerR, start);
    const d =
      sweep >= 359.999
        ? fullDonutPath(opts.cx, opts.cy, opts.r, opts.innerR)
        : `M ${o1.x.toFixed(2)} ${o1.y.toFixed(2)} A ${opts.r} ${opts.r} 0 ${large} 1 ${o2.x.toFixed(2)} ${o2.y.toFixed(2)} L ${i1.x.toFixed(2)} ${i1.y.toFixed(2)} A ${opts.innerR} ${opts.innerR} 0 ${large} 0 ${i2.x.toFixed(2)} ${i2.y.toFixed(2)} Z`;
    return { d, value, pct: value / total, start, end };
  });
}

function fullDonutPath(cx: number, cy: number, r: number, innerR: number): string {
  return [
    `M ${cx + r} ${cy}`,
    `A ${r} ${r} 0 1 1 ${cx - r} ${cy}`,
    `A ${r} ${r} 0 1 1 ${cx + r} ${cy}`,
    `M ${cx + innerR} ${cy}`,
    `A ${innerR} ${innerR} 0 1 0 ${cx - innerR} ${cy}`,
    `A ${innerR} ${innerR} 0 1 0 ${cx + innerR} ${cy}`,
    'Z',
  ].join(' ');
}

export function formatChartMoney(n: number): string {
  const v = Number(n) || 0;
  if (v >= 1000) {
    return `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  }
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatChartInt(n: number): string {
  return Math.round(Number(n) || 0).toLocaleString('pt-BR');
}

export function salesChartEmpty(days: SalesDayLike[]): boolean {
  return !days.some((d) => d.orderCount > 0 || d.revenue > 0);
}
