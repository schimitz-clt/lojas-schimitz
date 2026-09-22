'use client';

import { useMemo } from 'react';
import { brl } from '@/lib/api';
import {
  areaPath,
  barRects,
  donutSlices,
  fillSalesDays,
  formatChartInt,
  formatChartMoney,
  formatSalesDatePt,
  hBarRects,
  lineSeriesPoints,
  niceMax,
  pickTickIndexes,
  polylinePath,
  salesChartEmpty,
  salesPaymentMethodColor,
  salesPaymentMethodLabel,
  type SalesDayLike,
  type SalesPaymentMethodLike,
  type SalesProductLike,
} from '@/lib/admin-sales-ui';

type Props = {
  from: string;
  to: string;
  byDay?: SalesDayLike[];
  topProducts?: SalesProductLike[];
  byPaymentMethod?: SalesPaymentMethodLike[];
  /**
   * False when that array was omitted from GET /admin/reports/sales.
   * Omitted is —, not the empty-period message. Default true keeps the previous chart.
   */
  blocks?: {
    days?: boolean;
    payments?: boolean;
    products?: boolean;
  };
};

const TIME = { width: 360, height: 168, padL: 44, padR: 10, padT: 10, padB: 28 };
const DONUT = { cx: 56, cy: 56, r: 52, innerR: 30 };

function omittedChart() {
  return <p className="admin-empty">—</p>;
}

export function AdminSalesCharts({
  from,
  to,
  byDay,
  topProducts,
  byPaymentMethod,
  blocks,
}: Props) {
  const showDays = blocks?.days !== false;
  const showPayments = blocks?.payments !== false;
  const showProducts = blocks?.products !== false;
  const days = useMemo(() => fillSalesDays(byDay, from, to), [byDay, from, to]);
  const emptyDays = salesChartEmpty(days);
  const revMax = niceMax(Math.max(0, ...days.map((d) => d.revenue)));
  const ordMax = niceMax(Math.max(0, ...days.map((d) => d.orderCount)));
  const revPts = lineSeriesPoints(
    days.map((d) => d.revenue),
    TIME,
    revMax,
  );
  const ordBars = barRects(
    days.map((d) => d.orderCount),
    TIME,
    ordMax,
  );
  const xTicks = pickTickIndexes(days.length, days.length > 14 ? 5 : Math.min(7, days.length));
  const products = (topProducts || []).slice(0, 6);
  const productBars = hBarRects(
    products.map((p) => p.revenue),
    { width: 360, barH: 14, gap: 18, padL: 0, padR: 0 },
  );
  const methods = byPaymentMethod || [];
  const slices = donutSlices(
    methods.map((m) => m.revenue),
    DONUT,
  );

  return (
    <div className="admin-sales-charts">
      <section className="admin-card-pro admin-sales-chart-card">
        <div className="body">
          <h3>Receita no período</h3>
          {!showDays ? (
            omittedChart()
          ) : emptyDays ? (
            <p className="admin-empty">Sem vendas pagas no período.</p>
          ) : (
            <div className="admin-sales-chart-wrap">
              <svg
                className="admin-sales-chart"
                viewBox={`0 0 ${TIME.width} ${TIME.height}`}
                role="img"
                aria-label="Receita diária no período"
              >
                {[0, 0.5, 1].map((t) => {
                  const y = TIME.padT + (TIME.height - TIME.padT - TIME.padB) * (1 - t);
                  return (
                    <g key={t}>
                      <line
                        x1={TIME.padL}
                        x2={TIME.width - TIME.padR}
                        y1={y}
                        y2={y}
                        className="admin-sales-chart__grid"
                      />
                      <text x={4} y={y + 3} className="admin-sales-chart__tick">
                        {formatChartMoney(revMax * t)}
                      </text>
                    </g>
                  );
                })}
                <path d={areaPath(revPts, TIME.height - TIME.padB)} className="admin-sales-chart__area" />
                <path d={polylinePath(revPts)} className="admin-sales-chart__line" fill="none" />
                {xTicks.map((i) => (
                  <text
                    key={days[i].date}
                    x={revPts[i]?.x ?? 0}
                    y={TIME.height - 8}
                    textAnchor="middle"
                    className="admin-sales-chart__tick"
                  >
                    {formatSalesDatePt(days[i].date).slice(0, 5)}
                  </text>
                ))}
              </svg>
            </div>
          )}
        </div>
      </section>

      <section className="admin-card-pro admin-sales-chart-card">
        <div className="body">
          <h3>Pedidos por dia</h3>
          {!showDays ? (
            omittedChart()
          ) : emptyDays ? (
            <p className="admin-empty">Sem vendas pagas no período.</p>
          ) : (
            <div className="admin-sales-chart-wrap">
              <svg
                className="admin-sales-chart"
                viewBox={`0 0 ${TIME.width} ${TIME.height}`}
                role="img"
                aria-label="Quantidade de pedidos pagos por dia"
              >
                {[0, 0.5, 1].map((t) => {
                  const y = TIME.padT + (TIME.height - TIME.padT - TIME.padB) * (1 - t);
                  return (
                    <g key={t}>
                      <line
                        x1={TIME.padL}
                        x2={TIME.width - TIME.padR}
                        y1={y}
                        y2={y}
                        className="admin-sales-chart__grid"
                      />
                      <text x={4} y={y + 3} className="admin-sales-chart__tick">
                        {formatChartInt(ordMax * t)}
                      </text>
                    </g>
                  );
                })}
                {ordBars.map((b, i) => (
                  <rect
                    key={days[i].date}
                    x={b.x}
                    y={b.y}
                    width={b.w}
                    height={Math.max(b.h, b.value > 0 ? 1.5 : 0)}
                    rx="2"
                    className="admin-sales-chart__bar"
                  >
                    <title>
                      {formatSalesDatePt(days[i].date)}: {days[i].orderCount} ped.
                    </title>
                  </rect>
                ))}
                {xTicks.map((i) => (
                  <text
                    key={`t-${days[i].date}`}
                    x={(ordBars[i]?.x ?? 0) + (ordBars[i]?.w ?? 0) / 2}
                    y={TIME.height - 8}
                    textAnchor="middle"
                    className="admin-sales-chart__tick"
                  >
                    {formatSalesDatePt(days[i].date).slice(0, 5)}
                  </text>
                ))}
              </svg>
            </div>
          )}
        </div>
      </section>

      <section className="admin-card-pro admin-sales-chart-card">
        <div className="body">
          <h3>Métodos de pagamento</h3>
          {!showPayments ? (
            omittedChart()
          ) : methods.length && slices.length ? (
            <div className="admin-sales-donut">
              <svg
                className="admin-sales-donut__svg"
                viewBox="0 0 112 112"
                role="img"
                aria-label="Mix de métodos de pagamento"
              >
                {slices.map((s, i) => (
                  <path key={methods[i].method} d={s.d} fill={salesPaymentMethodColor(methods[i].method)}>
                    <title>
                      {salesPaymentMethodLabel(methods[i].method)}: {brl(methods[i].revenue)}
                    </title>
                  </path>
                ))}
              </svg>
              <ul className="admin-sales-legend">
                {methods.map((m, i) => (
                  <li key={m.method}>
                    <span
                      className="admin-sales-legend__swatch"
                      style={{ background: salesPaymentMethodColor(m.method) }}
                    />
                    <span className="admin-sales-legend__label">{salesPaymentMethodLabel(m.method)}</span>
                    <span className="admin-dense-row__meta">
                      {m.orderCount} ped. · {((slices[i]?.pct || 0) * 100).toFixed(0)}%
                    </span>
                    <b>{brl(m.revenue)}</b>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="admin-empty">Sem pagamentos aprovados no período.</p>
          )}
        </div>
      </section>

      <section className="admin-card-pro admin-sales-chart-card">
        <div className="body">
          <h3>Mais vendidos</h3>
          {!showProducts ? (
            omittedChart()
          ) : products.length ? (
            <ul className="admin-sales-hbars">
              {products.map((p, i) => (
                <li key={p.productId}>
                  <div className="admin-sales-hbars__meta">
                    <span className="admin-sales-hbars__name">{p.name}</span>
                    <span className="admin-dense-row__meta">{p.qty} un.</span>
                    <b>{brl(p.revenue)}</b>
                  </div>
                  <div className="admin-sales-hbars__track" aria-hidden="true">
                    <div
                      className="admin-sales-hbars__fill"
                      style={{ width: `${Math.max(4, (productBars[i]?.w / 360) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-empty">Sem vendas pagas no período.</p>
          )}
        </div>
      </section>
    </div>
  );
}
