import assert from 'assert';
import {
  addDaysYmd,
  areaPath,
  barRects,
  buildSalesReportCsv,
  csvEscape,
  daySpanInclusive,
  donutSlices,
  fillSalesDays,
  formatChartInt,
  formatSalesDatePt,
  formatSalesMoneyCsv,
  hBarRects,
  lineSeriesPoints,
  niceMax,
  pickTickIndexes,
  polylinePath,
  salesCsvWithBom,
  salesExportFilename,
  salesPaymentMethodColor,
  salesPaymentMethodLabel,
  scaleLinear,
} from './admin-sales-ui';

assert.equal(csvEscape('ok'), 'ok');
assert.equal(csvEscape('a;b'), '"a;b"');
assert.equal(csvEscape('150,00'), '150,00');
assert.equal(csvEscape('diz "oi"'), '"diz ""oi"""');
assert.equal(formatSalesMoneyCsv(1234.5), '1234,50');
assert.equal(formatSalesMoneyCsv(0), '0,00');
assert.equal(formatSalesDatePt('2026-09-17'), '17/09/2026');
assert.equal(formatSalesDatePt('bad'), 'bad');
assert.equal(salesExportFilename('2026-08-19', '2026-09-17'), 'vendas-2026-08-19_2026-09-17.csv');
assert.equal(salesPaymentMethodLabel('pix'), 'PIX');
assert.equal(salesPaymentMethodLabel('card'), 'Cartão');
assert.equal(salesPaymentMethodLabel('boleto'), 'Boleto');
assert.equal(salesPaymentMethodLabel('wallet'), 'Carteira');
assert.ok(salesPaymentMethodColor('pix').startsWith('#'));

const csv = buildSalesReportCsv(
  {
    from: '2026-09-01',
    to: '2026-09-07',
    timezone: 'America/Sao_Paulo',
    summary: { orderCount: 2, revenue: 150, averageTicket: 75 },
    byStatus: { paid: 2, awaiting_payment: 1 },
    byDay: [
      { date: '2026-09-01', orderCount: 1, revenue: 100 },
      { date: '2026-09-02', orderCount: 1, revenue: 50 },
    ],
    topProducts: [{ productId: 'p1', name: 'TV 55"', qty: 1, revenue: 100 }],
    bySeller: [
      { sellerId: null, sellerName: 'Loja própria', orderCount: 2, itemQty: 2, revenue: 150 },
    ],
    byPaymentMethod: [
      { method: 'pix', orderCount: 1, revenue: 100 },
      { method: 'card', orderCount: 1, revenue: 50 },
    ],
  },
  (st) => (st === 'paid' ? 'Pago' : st === 'awaiting_payment' ? 'Aguardando pagamento' : st),
);

assert.ok(csv.includes('Resumo'), 'resumo section');
assert.ok(csv.includes('Pedidos pagos;2'), 'summary count');
assert.ok(csv.includes('Receita;150,00'), 'summary revenue PT');
assert.ok(csv.includes('Por dia'), 'by day');
assert.ok(csv.includes('01/09/2026;1;100,00'), 'day row');
assert.ok(csv.includes('Pago;2'), 'status PT');
assert.ok(csv.includes('Aguardando pagamento;1'), 'unpaid status still exported');
assert.ok(csv.includes('TV 55"') || csv.includes('"TV 55"""'), 'product name');
assert.ok(csv.includes('Loja própria;2;2;150,00'), 'seller row');
assert.ok(csv.includes('PIX;1;100,00'), 'pix mix');
assert.ok(csv.includes('Cartão;1;50,00'), 'card mix');
assert.ok(salesCsvWithBom(csv).charCodeAt(0) === 0xfeff, 'utf8 bom');

assert.equal(addDaysYmd('2026-09-01', 1), '2026-09-02');
assert.equal(daySpanInclusive('2026-09-01', '2026-09-07'), 7);
const filled = fillSalesDays(
  [{ date: '2026-09-01', orderCount: 1, revenue: 10 }],
  '2026-09-01',
  '2026-09-03',
);
assert.equal(filled.length, 3, 'filled days');
assert.equal(filled[1].orderCount, 0);
assert.equal(filled[1].revenue, 0);

assert.equal(niceMax(0), 1);
assert.equal(niceMax(12), 20);
assert.equal(scaleLinear(50, 0, 100, 0, 10), 5);

const box = { width: 200, height: 80, padL: 20, padR: 10, padT: 8, padB: 12 };
const pts = lineSeriesPoints([0, 10, 5], box, 10);
assert.equal(pts.length, 3);
assert.ok(pts[0].y > pts[1].y, 'higher value is higher on chart (smaller y)');
assert.ok(polylinePath(pts).startsWith('M'));
assert.ok(areaPath(pts, 68).endsWith('Z'));

const bars = barRects([0, 10], box, 10);
assert.equal(bars.length, 2);
assert.equal(bars[0].h, 0);
assert.ok(bars[1].h > 0);

const hb = hBarRects([10, 5], { width: 200, barH: 12, gap: 4, padL: 80, padR: 8 });
assert.equal(hb.length, 2);
assert.ok(hb[0].w > hb[1].w);

assert.deepEqual(pickTickIndexes(30, 5), [0, 7, 15, 22, 29]);
assert.deepEqual(pickTickIndexes(3, 5), [0, 1, 2]);

const slices = donutSlices([75, 25], { cx: 40, cy: 40, r: 32, innerR: 18 });
assert.equal(slices.length, 2);
assert.ok(Math.abs(slices[0].pct - 0.75) < 0.001);
assert.ok(slices[0].d.includes('A'));
assert.equal(donutSlices([0, 0], { cx: 40, cy: 40, r: 32, innerR: 18 }).length, 0);
assert.equal(formatChartInt(1200), '1.200');

console.log('admin-sales-ui.spec.ts OK');
