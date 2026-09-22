'use client';

import Link from 'next/link';
import { brl } from '@/lib/api';
import { buildAdminSectionHref } from '@/lib/admin-sections';
import { formatSalesDatePt } from '@/lib/admin-sales-ui';
import {
  formatOpsSnapshotTime,
  opsAlertCtaHintPt,
  opsCountOrDash,
  OPS_DO_HEADING,
  OPS_NOW_HEADING,
  partitionSectionAlerts,
  salesReportOutsideSnapshotNote,
  salesWindowAlignmentNote,
  vendasCommandCounts,
  vendasNowSummary,
  vendasQuickActionFigure,
  VENDAS_CHART_FILL_NOTE,
  VENDAS_DO_LEDE,
  VENDAS_EVIDENCE_LEDE,
  VENDAS_NOW_LEDE,
  VENDAS_QUICK_ACTIONS,
  VENDAS_READONLY_NOTE,
  VENDAS_REPORT_MISSING,
  type VendasQuickActionId,
  type VendasWindowCounts,
} from '@/lib/admin-ops-ui';
import { ENTERPRISE_MISSING, salesEvidenceModel } from '@/lib/admin-enterprise-ui';
import { AdminAttentionStrip } from '@/components/admin/AdminAttentionStrip';
import { AdminSalesCharts } from '@/components/admin/AdminSalesCharts';
import { AdminStatusChip } from '@/components/admin/AdminStatusChip';
import { salesPresetActive } from '@/lib/admin-pro-ui';
import { useAdminConsole } from '@/components/admin/admin-console-context';
import { addDaysYmd, saoPauloYmd, type AdminOpsAlert } from '@/components/admin/admin-console-model';

function toAttentionItem(a: AdminOpsAlert) {
  const count = typeof a.count === 'number' && Number.isFinite(a.count) ? a.count : null;
  return {
    code: a.code,
    severity: a.severity,
    message: a.message,
    count,
    recommendedAction: a.recommendedAction,
    evidenceLine: a.evidence?.reason
      ? `Evidência: ${a.evidence.reason}${
          a.evidence.providerStatus ? ` · status ${a.evidence.providerStatus}` : ''
        }${a.evidence.externalReference ? ` · ref ${a.evidence.externalReference}` : ''}`
      : null,
    ctaHint: opsAlertCtaHintPt(a),
  };
}

function rangeHint(window: VendasWindowCounts | null, ready: boolean): string {
  if (!ready) return 'aguardando snapshot';
  if (!window) return 'sem janela neste snapshot';
  if (!window.from && !window.to) return 'período —';
  const from = window.from ? formatSalesDatePt(window.from) : ENTERPRISE_MISSING;
  const to = window.to ? formatSalesDatePt(window.to) : ENTERPRISE_MISSING;
  return from === to ? from : `${from} – ${to}`;
}

function moneyValue(window: VendasWindowCounts | null, ready: boolean): string {
  if (!ready || !window || window.revenue == null) return ENTERPRISE_MISSING;
  return brl(window.revenue);
}

function countValue(window: VendasWindowCounts | null, ready: boolean): string {
  if (!ready || !window) return ENTERPRISE_MISSING;
  return opsCountOrDash(window.orderCount, true);
}

function windowDates(window: VendasWindowCounts | null, fallbackFrom: string, fallbackTo: string) {
  if (window?.from && window.to) return { from: window.from, to: window.to };
  return { from: fallbackFrom, to: fallbackTo };
}

function MissingBlock() {
  return <p className="admin-ent-note">— · este bloco não veio no payload.</p>;
}

export function AdminVendasSection() {
  const {
    ops,
    opsSnapshot,
    opsBusy,
    loadOps,
    selectOpsAlert,
    selectOpsBucket,
    salesReport,
    salesFrom,
    setSalesFrom,
    salesTo,
    setSalesTo,
    salesBusy,
    salesExportBusy,
    loadSalesReport,
    exportSalesCsv,
  } = useAdminConsole();

  const ready = ops != null;
  const counts = vendasCommandCounts(ops, ready);
  const sectionAlerts = partitionSectionAlerts(ops?.alerts, 'vendas');
  const snapshotState = ops ? 'ready' : opsSnapshot;
  const evidence = salesReport ? salesEvidenceModel(salesReport) : null;
  const reportOrders =
    salesReport && typeof salesReport.summary?.orderCount === 'number' && Number.isFinite(salesReport.summary.orderCount)
      ? salesReport.summary.orderCount
      : null;
  const todayAlign = salesReport
    ? salesWindowAlignmentNote(salesReport.from, salesReport.to, reportOrders, counts.today, 'Hoje')
    : null;
  const lastAlign = salesReport
    ? salesWindowAlignmentNote(salesReport.from, salesReport.to, reportOrders, counts.last30d, '30 dias')
    : null;
  const outsideNote =
    salesReport && !todayAlign && !lastAlign
      ? salesReportOutsideSnapshotNote(salesReport.from, salesReport.to, counts.today, counts.last30d)
      : null;
  const todayYmd = saoPauloYmd();

  function scrollEvidence() {
    document.getElementById('admin-vendas-evidence')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function applyWindow(window: VendasWindowCounts | null) {
    if (!salesBusy && window?.from && window.to) {
      setSalesFrom(window.from);
      setSalesTo(window.to);
      void loadSalesReport(window.from, window.to);
    }
    scrollEvidence();
  }

  function runQuickAction(id: VendasQuickActionId) {
    if (id === 'today') {
      const range = windowDates(counts.today, todayYmd, todayYmd);
      setSalesFrom(range.from);
      setSalesTo(range.to);
      void loadSalesReport(range.from, range.to);
      scrollEvidence();
      return;
    }
    if (id === 'days30') {
      const range = windowDates(counts.last30d, addDaysYmd(todayYmd, -29), todayYmd);
      setSalesFrom(range.from);
      setSalesTo(range.to);
      void loadSalesReport(range.from, range.to);
      scrollEvidence();
      return;
    }
    if (id === 'csv') {
      exportSalesCsv();
      return;
    }
    if (id === 'pedidos') selectOpsBucket('');
  }

  return (
    <>
      <div className="admin-section-panel admin-vendas admin-cc">
        <header className="admin-cc-banner">
          <div>
            <p className="admin-cc-banner__eyebrow">Vendas</p>
            <p className="admin-cc-banner__title">Receita do snapshot, um GET /admin/ops.</p>
            <p className="admin-cc-banner__meta">
              Snapshot{' '}
              {ops?.time ? <time dateTime={ops.time}>{formatOpsSnapshotTime(ops.time)}</time> : '—'}
              {' · '}
              GET /admin/ops
            </p>
          </div>
          <button
            type="button"
            className="admin-cc-banner__refresh"
            disabled={opsBusy || salesBusy}
            onClick={() => {
              void loadOps();
              void loadSalesReport(salesFrom, salesTo);
            }}
          >
            {opsBusy || salesBusy ? 'Atualizando…' : 'Atualizar'}
          </button>
        </header>

        <section className="admin-cc-block" aria-labelledby="vendas-now-heading">
          <p className="admin-cc-block__step">01</p>
          <h2 id="vendas-now-heading" className="admin-cc-block__title">
            {OPS_NOW_HEADING}
          </h2>
          <p className="admin-cc-block__lede">{VENDAS_NOW_LEDE}</p>
          <p className="admin-cc-nowline" role="status">
            {vendasNowSummary(counts, snapshotState)}
          </p>
          <div className="admin-cc-kpi-grid">
            <button type="button" className="admin-cc-kpi" onClick={() => applyWindow(counts.today)}>
              <div className="admin-cc-kpi__label">Receita hoje</div>
              <div className="admin-cc-kpi__value">{moneyValue(counts.today, ready)}</div>
              <div className="admin-cc-kpi__hint">
                {counts.today?.orderCount != null && ready
                  ? `${counts.today.orderCount} pedido(s) pagos`
                  : rangeHint(counts.today, ready)}
              </div>
            </button>
            <button type="button" className="admin-cc-kpi" onClick={() => applyWindow(counts.today)}>
              <div className="admin-cc-kpi__label">Pedidos pagos hoje</div>
              <div className="admin-cc-kpi__value">{countValue(counts.today, ready)}</div>
              <div className="admin-cc-kpi__hint">{rangeHint(counts.today, ready)}</div>
            </button>
            <button type="button" className="admin-cc-kpi" onClick={() => applyWindow(counts.last30d)}>
              <div className="admin-cc-kpi__label">Receita 30 dias</div>
              <div className="admin-cc-kpi__value">{moneyValue(counts.last30d, ready)}</div>
              <div className="admin-cc-kpi__hint">
                {counts.last30d?.orderCount != null && ready
                  ? `${counts.last30d.orderCount} pedido(s) pagos`
                  : rangeHint(counts.last30d, ready)}
              </div>
            </button>
            <button type="button" className="admin-cc-kpi" onClick={() => applyWindow(counts.last30d)}>
              <div className="admin-cc-kpi__label">Pedidos pagos 30 dias</div>
              <div className="admin-cc-kpi__value">{countValue(counts.last30d, ready)}</div>
              <div className="admin-cc-kpi__hint">{rangeHint(counts.last30d, ready)}</div>
            </button>
          </div>
        </section>

        <AdminAttentionStrip
          variant="command"
          snapshot={snapshotState}
          infoCount={sectionAlerts.signals.length}
          max={Math.max(sectionAlerts.attention.length, 1)}
          items={sectionAlerts.attention.map(toAttentionItem)}
          signals={sectionAlerts.signals.map(toAttentionItem)}
          onSelect={(code) => {
            const alert = (ops?.alerts ?? []).find((item) => item.code === code);
            if (alert) selectOpsAlert(alert);
          }}
        />

        <section className="admin-cc-block" aria-labelledby="vendas-do-heading">
          <p className="admin-cc-block__step">03</p>
          <h2 id="vendas-do-heading" className="admin-cc-block__title">
            {OPS_DO_HEADING}
          </h2>
          <p className="admin-cc-block__lede">{VENDAS_DO_LEDE}</p>
          <div className="admin-cc-actions admin-cc-actions--sticky">
            {VENDAS_QUICK_ACTIONS.map((action) => {
              const figure = vendasQuickActionFigure(action.id, counts);
              if (action.id === 'clientes') {
                return (
                  <Link key={action.id} className="admin-cc-action" href={buildAdminSectionHref('clientes')}>
                    <span className="admin-cc-action__label">{action.label}</span>
                    <span className="admin-cc-action__hint">{action.hint}</span>
                  </Link>
                );
              }
              const disabled =
                (action.id === 'csv' && (salesExportBusy || !salesReport)) ||
                ((action.id === 'today' || action.id === 'days30') && salesBusy);
              return (
                <button
                  key={action.id}
                  type="button"
                  className="admin-cc-action"
                  disabled={disabled}
                  onClick={() => runQuickAction(action.id)}
                >
                  <span className="admin-cc-action__label">{action.label}</span>
                  <span className="admin-cc-action__hint">{action.hint}</span>
                  {figure ? <span className="admin-cc-action__figure">{figure}</span> : null}
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <div className="admin-section-panel admin-vendas" id="admin-vendas-evidence">
        <section className="admin-cc-block" aria-labelledby="vendas-evidence-heading">
          <p className="admin-ent-kicker">Evidência</p>
          <h2 id="vendas-evidence-heading" className="admin-cc-block__title">
            O que o período mostra
          </h2>
          <p className="admin-cc-block__lede">{VENDAS_EVIDENCE_LEDE}</p>
          <p className="admin-ent-note">{VENDAS_READONLY_NOTE}</p>

          <div className="admin-toolbar">
            <div className="admin-filter-row">
              {[
                { label: 'Hoje', from: todayYmd, to: todayYmd },
                { label: '7 dias', from: addDaysYmd(todayYmd, -6), to: todayYmd },
                { label: '30 dias', from: addDaysYmd(todayYmd, -29), to: todayYmd },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className={`admin-filter-chip${salesPresetActive(salesFrom, salesTo, preset.from, preset.to) ? ' is-active' : ''}`}
                  disabled={salesBusy}
                  onClick={() => {
                    setSalesFrom(preset.from);
                    setSalesTo(preset.to);
                    void loadSalesReport(preset.from, preset.to);
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <form
              className="admin-toolbar__row admin-sales-toolbar"
              onSubmit={(e) => {
                e.preventDefault();
                void loadSalesReport(salesFrom, salesTo);
              }}
            >
              <label className="admin-date-field">
                De
                <input type="date" value={salesFrom} onChange={(e) => setSalesFrom(e.target.value)} required />
              </label>
              <label className="admin-date-field">
                Até
                <input type="date" value={salesTo} onChange={(e) => setSalesTo(e.target.value)} required />
              </label>
              <div className="admin-sales-toolbar__actions">
                <button className="btn admin-btn-primary-accent" type="submit" disabled={salesBusy}>
                  {salesBusy ? 'Carregando...' : 'Atualizar'}
                </button>
                <button
                  className="btn admin-btn-ghost-pro"
                  type="button"
                  disabled={salesBusy || salesExportBusy || !salesReport}
                  onClick={() => exportSalesCsv()}
                >
                  {salesExportBusy ? 'Exportando...' : 'Exportar CSV'}
                </button>
              </div>
            </form>
          </div>

          {evidence ? (
            <>
              <div className="admin-ent-facts">
                <div className="admin-ent-fact">
                  <span>De</span>
                  <strong>{evidence.periodFrom}</strong>
                </div>
                <div className="admin-ent-fact">
                  <span>Até</span>
                  <strong>{evidence.periodTo}</strong>
                </div>
                <div className="admin-ent-fact">
                  <span>Fuso</span>
                  <strong>{evidence.timezone}</strong>
                </div>
                <div className="admin-ent-fact">
                  <span>Pedidos pagos</span>
                  <strong>{evidence.orderCount}</strong>
                </div>
                <div className="admin-ent-fact">
                  <span>Receita</span>
                  <strong>{evidence.revenue}</strong>
                </div>
                <div className="admin-ent-fact">
                  <span>Ticket médio</span>
                  <strong>{evidence.averageTicket}</strong>
                </div>
              </div>
              {todayAlign ? <p className="admin-cc-work__note">{todayAlign}</p> : null}
              {lastAlign ? <p className="admin-cc-work__note">{lastAlign}</p> : null}
              {outsideNote ? <p className="admin-cc-work__note">{outsideNote}</p> : null}

              <div className="admin-vendas-grid">
                <div className="admin-vendas-block">
                  <h3 className="admin-ent-h">Por status</h3>
                  {evidence.byStatusMissing ? (
                    <MissingBlock />
                  ) : evidence.byStatus.length ? (
                    <div className="admin-ent-table-wrap">
                      <table className="admin-ent-table">
                        <thead>
                          <tr>
                            <th>Status</th>
                            <th className="num">Qtd</th>
                          </tr>
                        </thead>
                        <tbody>
                          {evidence.byStatus.map((row) => (
                            <tr key={row.status || 'status'}>
                              <td>
                                {row.bucket ? (
                                  <button
                                    type="button"
                                    className="admin-link-btn"
                                    onClick={() => selectOpsBucket(row.bucket as string)}
                                  >
                                    {row.label}
                                  </button>
                                ) : (
                                  row.label
                                )}
                                {row.status && row.label !== row.status ? (
                                  <span className="admin-dense-row__meta"> {row.status}</span>
                                ) : null}
                              </td>
                              <td className="num">{row.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="admin-empty">Nenhum pedido no período.</p>
                  )}
                </div>

                <div className="admin-vendas-block">
                  <h3 className="admin-ent-h">Por método de pagamento</h3>
                  {evidence.byPaymentMissing ? (
                    <MissingBlock />
                  ) : evidence.byPaymentMethod.length ? (
                    <div className="admin-ent-table-wrap">
                      <table className="admin-ent-table">
                        <thead>
                          <tr>
                            <th>Método</th>
                            <th className="num">Pedidos</th>
                            <th className="num">Receita</th>
                          </tr>
                        </thead>
                        <tbody>
                          {evidence.byPaymentMethod.map((row, index) => (
                            <tr key={`${row.method}-${index}`}>
                              <td>
                                {row.label}
                                {row.method !== ENTERPRISE_MISSING && row.label !== row.method ? (
                                  <span className="admin-dense-row__meta"> {row.method}</span>
                                ) : null}
                              </td>
                              <td className="num">{row.orderCount}</td>
                              <td className="num">{row.revenue}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="admin-empty">Sem pagamentos aprovados no período.</p>
                  )}
                </div>

                <div className="admin-vendas-block">
                  <h3 className="admin-ent-h">Mais vendidos</h3>
                  {evidence.topProductsMissing ? (
                    <MissingBlock />
                  ) : evidence.topProducts.length ? (
                    <div className="admin-ent-table-wrap">
                      <table className="admin-ent-table">
                        <thead>
                          <tr>
                            <th>Produto</th>
                            <th className="num">Qtd</th>
                            <th className="num">Receita</th>
                          </tr>
                        </thead>
                        <tbody>
                          {evidence.topProducts.map((row, index) => (
                            <tr key={`${row.productId}-${index}`}>
                              <td>
                                {row.name}
                                <span className="admin-dense-row__meta"> {row.productId}</span>
                              </td>
                              <td className="num">{row.qty}</td>
                              <td className="num">{row.revenue}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="admin-empty">Sem vendas pagas no período.</p>
                  )}
                </div>

                <div className="admin-vendas-block">
                  <h3 className="admin-ent-h">Por vendedor</h3>
                  {evidence.bySellerMissing ? (
                    <MissingBlock />
                  ) : evidence.bySeller.length ? (
                    <div className="admin-ent-table-wrap">
                      <table className="admin-ent-table">
                        <thead>
                          <tr>
                            <th>Vendedor</th>
                            <th className="num">Pedidos</th>
                            <th className="num">Itens</th>
                            <th className="num">Receita</th>
                          </tr>
                        </thead>
                        <tbody>
                          {evidence.bySeller.map((row, index) => (
                            <tr key={`${row.sellerId}-${index}`}>
                              <td>
                                {row.name}
                                {row.ownStore ? <AdminStatusChip label="própria" tone="accent" /> : null}
                                {!row.ownStore ? (
                                  <span className="admin-dense-row__meta"> {row.sellerId}</span>
                                ) : null}
                              </td>
                              <td className="num">{row.orderCount}</td>
                              <td className="num">{row.itemQty}</td>
                              <td className="num">{row.revenue}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="admin-empty">Sem itens de vendas pagas (marketplace) no período.</p>
                  )}
                </div>
              </div>

              <h3 className="admin-ent-h">Por dia</h3>
              {evidence.byDayMissing ? (
                <MissingBlock />
              ) : evidence.byDay.length ? (
                <div className="admin-ent-table-wrap">
                  <table className="admin-ent-table">
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th className="num">Pedidos</th>
                        <th className="num">Receita</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evidence.byDay.map((row, index) => (
                        <tr key={`${row.date}-${index}`}>
                          <td>{row.label}</td>
                          <td className="num">{row.orderCount}</td>
                          <td className="num">{row.revenue}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="admin-empty">Sem vendas pagas no período.</p>
              )}

              {evidence.byDayMissing ? null : <p className="admin-ent-note">{VENDAS_CHART_FILL_NOTE}</p>}
              <AdminSalesCharts
                from={salesReport?.from || ''}
                to={salesReport?.to || ''}
                byDay={evidence.byDayMissing ? undefined : salesReport?.byDay}
                topProducts={evidence.topProductsMissing ? undefined : salesReport?.topProducts}
                byPaymentMethod={evidence.byPaymentMissing ? undefined : salesReport?.byPaymentMethod}
                blocks={{
                  days: !evidence.byDayMissing,
                  payments: !evidence.byPaymentMissing,
                  products: !evidence.topProductsMissing,
                }}
              />
            </>
          ) : salesBusy ? (
            <p className="admin-empty">Carregando relatório…</p>
          ) : (
            <p className="admin-ent-note">{VENDAS_REPORT_MISSING}</p>
          )}
        </section>
      </div>
    </>
  );
}
