import {
  aggregateByDay,
  aggregateBySeller,
  aggregateTopProducts,
  computeSalesSummary,
  moneyRound,
  parseSalesDateRange,
  saoPauloYmd,
} from './admin-sales-report';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const s = computeSalesSummary([100, 50.5, 49.5]);
assert(s.orderCount === 3, 'order count');
assert(s.revenue === 200, `revenue got ${s.revenue}`);
assert(s.averageTicket === moneyRound(200 / 3), `ticket got ${s.averageTicket}`);

const empty = computeSalesSummary([]);
assert(empty.orderCount === 0 && empty.revenue === 0 && empty.averageTicket === 0, 'empty summary');

const top = aggregateTopProducts(
  [
    { productId: 'a', name: 'TV', qty: 2, unitPrice: 100 },
    { productId: 'b', name: 'Fone', qty: 5, unitPrice: 20 },
    { productId: 'a', name: 'TV', qty: 1, unitPrice: 100 },
  ],
  10,
);
assert(top[0].productId === 'b' && top[0].qty === 5 && top[0].revenue === 100, 'top by qty');
assert(top[1].productId === 'a' && top[1].qty === 3 && top[1].revenue === 300, 'tv agg');

const r = parseSalesDateRange('2026-09-01', '2026-09-05');
assert(r.from === '2026-09-01' && r.to === '2026-09-05', 'ymd preserved');
assert(r.fromDate.toISOString() === '2026-09-01T03:00:00.000Z', `from ISO ${r.fromDate.toISOString()}`);
assert(r.toDateExclusive.toISOString() === '2026-09-06T03:00:00.000Z', `to excl ${r.toDateExclusive.toISOString()}`);

const swapped = parseSalesDateRange('2026-09-10', '2026-09-01');
assert(swapped.from === '2026-09-01' && swapped.to === '2026-09-10', 'swap from/to');

let threw = false;
try {
  parseSalesDateRange('01-09-2026', '2026-09-05');
} catch {
  threw = true;
}
assert(threw, 'invalid date format');

assert(saoPauloYmd(new Date('2026-09-05T02:30:00.000Z')) === '2026-09-04', 'ymd before midnight BRT');
assert(saoPauloYmd(new Date('2026-09-05T03:00:00.000Z')) === '2026-09-05', 'ymd at midnight BRT');

const byDay = aggregateByDay([
  { createdAt: new Date('2026-09-01T15:00:00.000Z'), total: 100 },
  { createdAt: new Date('2026-09-01T20:00:00.000Z'), total: 50 },
  { createdAt: new Date('2026-09-02T12:00:00.000Z'), total: 30 },
]);
assert(byDay.length === 2, 'byDay length');
assert(byDay[0].date === '2026-09-01' && byDay[0].orderCount === 2 && byDay[0].revenue === 150, 'day1');
assert(byDay[1].date === '2026-09-02' && byDay[1].orderCount === 1 && byDay[1].revenue === 30, 'day2');

const bySeller = aggregateBySeller([
  { orderId: 'o1', sellerId: 's1', sellerName: 'Parceiro A', qty: 2, unitPrice: 50 },
  { orderId: 'o1', sellerId: null, sellerName: null, qty: 1, unitPrice: 20 },
  { orderId: 'o2', sellerId: 's1', sellerName: 'Parceiro A', qty: 1, unitPrice: 10 },
  { orderId: 'o3', sellerId: null, qty: 3, unitPrice: 5 },
]);
assert(bySeller[0].sellerId === 's1' && bySeller[0].revenue === 110 && bySeller[0].orderCount === 2, 'seller top');
assert(bySeller[0].itemQty === 3, 'seller qty');
const store = bySeller.find((x) => x.sellerId === null);
assert(
  !!store && store.sellerName === 'Loja própria' && store.revenue === 35 && store.orderCount === 2,
  'store bucket',
);

console.log('admin-sales-report.spec.ts OK');
