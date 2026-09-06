/** Statuses that count as paid revenue (pós-pagamento, ainda não cancelado/reembolsado). */
export const PAID_REVENUE_STATUSES = [
  'paid',
  'organizing',
  'packing',
  'ready_for_pickup',
  'in_transit',
  'delivered',
  'separating',
  'shipped',
] as const;

export type PaidRevenueStatus = (typeof PAID_REVENUE_STATUSES)[number];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Interpreta YYYY-MM-DD como início/fim do dia em America/Sao_Paulo (UTC−3, sem DST). */
export function parseSalesDateRange(from?: string, to?: string): {
  from: string;
  to: string;
  fromDate: Date;
  toDateExclusive: Date;
} {
  const today = saoPauloYmd(new Date());
  let fromYmd = (from || '').trim() || defaultFromYmd(today, 29);
  let toYmd = (to || '').trim() || today;

  if (!DATE_RE.test(fromYmd) || !DATE_RE.test(toYmd)) {
    throw new Error('Datas inválidas. Use YYYY-MM-DD em from e to.');
  }
  if (fromYmd > toYmd) {
    const tmp = fromYmd;
    fromYmd = toYmd;
    toYmd = tmp;
  }

  const fromDate = new Date(`${fromYmd}T00:00:00-03:00`);
  const toDateExclusive = new Date(`${toYmd}T00:00:00-03:00`);
  toDateExclusive.setUTCDate(toDateExclusive.getUTCDate() + 1);

  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDateExclusive.getTime())) {
    throw new Error('Datas inválidas. Use YYYY-MM-DD em from e to.');
  }

  return { from: fromYmd, to: toYmd, fromDate, toDateExclusive };
}

function defaultFromYmd(todayYmd: string, daysBackInclusive: number): string {
  const d = new Date(`${todayYmd}T12:00:00-03:00`);
  d.setUTCDate(d.getUTCDate() - daysBackInclusive);
  return saoPauloYmd(d);
}

/** YYYY-MM-DD no fuso America/Sao_Paulo. */
export function saoPauloYmd(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function moneyRound(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export type TopProductAgg = {
  productId: string;
  name: string;
  qty: number;
  revenue: number;
};

export function aggregateTopProducts(
  items: { productId: string; name: string; qty: number; unitPrice: number }[],
  limit = 10,
): TopProductAgg[] {
  const map = new Map<string, TopProductAgg>();
  for (const it of items) {
    const prev = map.get(it.productId);
    const line = it.qty * it.unitPrice;
    if (prev) {
      prev.qty += it.qty;
      prev.revenue = moneyRound(prev.revenue + line);
    } else {
      map.set(it.productId, {
        productId: it.productId,
        name: it.name,
        qty: it.qty,
        revenue: moneyRound(line),
      });
    }
  }
  return [...map.values()]
    .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue || a.name.localeCompare(b.name, 'pt-BR'))
    .slice(0, limit);
}

export function computeSalesSummary(paidTotals: number[]) {
  const orderCount = paidTotals.length;
  const revenue = moneyRound(paidTotals.reduce((s, t) => s + t, 0));
  const averageTicket = orderCount ? moneyRound(revenue / orderCount) : 0;
  return { orderCount, revenue, averageTicket };
}

export type ByDayAgg = {
  date: string;
  orderCount: number;
  revenue: number;
};

/** Agrupa pedidos pagos por dia (YYYY-MM-DD em America/Sao_Paulo). */
export function aggregateByDay(
  orders: { createdAt: Date | string; total: number }[],
): ByDayAgg[] {
  const map = new Map<string, ByDayAgg>();
  for (const o of orders) {
    const d = typeof o.createdAt === 'string' ? new Date(o.createdAt) : o.createdAt;
    const date = saoPauloYmd(d);
    const prev = map.get(date);
    if (prev) {
      prev.orderCount += 1;
      prev.revenue = moneyRound(prev.revenue + o.total);
    } else {
      map.set(date, { date, orderCount: 1, revenue: moneyRound(o.total) });
    }
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export type BySellerAgg = {
  sellerId: string | null;
  sellerName: string;
  orderCount: number;
  itemQty: number;
  revenue: number;
};

/**
 * Agrupa itens de pedidos pagos por vendedor (marketplace).
 * Itens sem sellerId entram como "Loja própria".
 * orderCount = pedidos distintos com pelo menos um item do vendedor.
 */
export function aggregateBySeller(
  items: {
    orderId: string;
    sellerId: string | null | undefined;
    sellerName?: string | null;
    qty: number;
    unitPrice: number;
  }[],
): BySellerAgg[] {
  type Acc = BySellerAgg & { orderIds: Set<string> };
  const map = new Map<string, Acc>();
  for (const it of items) {
    const key = it.sellerId || '__store__';
    const name = it.sellerId
      ? (it.sellerName?.trim() || 'Vendedor')
      : 'Loja própria';
    let acc = map.get(key);
    if (!acc) {
      acc = {
        sellerId: it.sellerId || null,
        sellerName: name,
        orderCount: 0,
        itemQty: 0,
        revenue: 0,
        orderIds: new Set(),
      };
      map.set(key, acc);
    } else if (it.sellerId && it.sellerName?.trim()) {
      acc.sellerName = it.sellerName.trim();
    }
    acc.orderIds.add(it.orderId);
    acc.itemQty += it.qty;
    acc.revenue = moneyRound(acc.revenue + it.qty * it.unitPrice);
  }
  return [...map.values()]
    .map(({ orderIds, ...rest }) => ({
      ...rest,
      orderCount: orderIds.size,
    }))
    .sort(
      (a, b) =>
        b.revenue - a.revenue ||
        b.itemQty - a.itemQty ||
        a.sellerName.localeCompare(b.sellerName, 'pt-BR'),
    );
}

