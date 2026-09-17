'use client';

import Link from 'next/link';
import { brl } from '@/lib/api';
import {
  orderStatusLabel,
  adminQueueBucketLabel,
  POST_PAYMENT_OPS_HINT,
  isPostPaidStatus,
} from '@/lib/order-status';
import { isPlaceholderImageUrl } from '@/lib/placeholder-image';
import { rewritePublicUploadUrl } from '@/lib/public-upload-url';
import { shouldServerOrderSearch } from '@/lib/admin-order-search';
import {
  emptyOrdersQueueMessage,
  paymentMethodBadge,
  whatsAppOpsButtonLabel,
} from '@/lib/admin-ops-ui';
import { AdminAttentionStrip } from '@/components/admin/AdminAttentionStrip';
import { AdminSalesCharts } from '@/components/admin/AdminSalesCharts';
import {
  AdminOrderStatusChip,
  AdminProductActiveChip,
  AdminProductStockChip,
  AdminStatusChip,
} from '@/components/admin/AdminStatusChip';
import {
  adminUserStatusLabel,
  adminUserStatusTone,
  bannerActiveLabel,
  commissionStatusLabel,
  commissionStatusTone,
  couponIsExhausted,
  couponIsExpired,
  couponListStats,
  customerAccountLabel,
  customerAccountTone,
  paidQueueBannerClass,
  paidQueueBannerTone,
  productPhotoBadgeKind,
  productPhotoBadgeLabel,
  reviewStars,
  reviewStatusLabel,
  reviewStatusTone,
  salesPresetActive,
  sellerStatusLabel,
  sellerStatusTone,
  shippingZoneActiveLabel,
  shouldStickyOrderActions,
} from '@/lib/admin-pro-ui';
import {
  emptyPhotoQueueMessage,
  isBulkAdvanceEligible,
  isBulkSepararEligible,
  photoQueueAlignmentNote,
  productNeedsStorePhoto,
  selectVisibleEligibleIds,
  toggleIdInList,
} from '@/lib/admin-daily-ops';
import {
  customerHistoryEmptyMessage,
  customerOrderPaymentLabel,
  customerOrdersEmptyMessage,
  customerVerClienteLabel,
  formatAdminDate,
  formatAdminDateTime,
  formatCustomerAddressLine,
  formatCustomerCityUf,
} from '@/lib/admin-customers-ui';
import { useAdminConsole } from '@/components/admin/admin-console-context';
import {
  DEFAULT_LOW_STOCK,
  MAX_PRODUCT_IMAGES,
  addDaysYmd,
  availableStock,
  customerHint,
  formatStuckHours,
  isPaidStuckOrder,
  hoursSincePaid,
  advanceButtonLabel,
  orderWa,
  saoPauloYmd,
} from '@/components/admin/admin-console-model';

export function AdminVendasSection() {
  const {
    form,
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
  return (
    <>
      <div className="admin-section-panel">
      <p className="admin-section-intro">
        Pedidos pagos no período (pago, organizando, saiu para entrega, entregue). Horário de Brasília.
        Exportar CSV usa o mesmo recorte (filtros acima; padrão 30 dias).
      </p>
      <div className="admin-toolbar">
          <div className="admin-filter-row">
            {[
              { label: 'Hoje', from: saoPauloYmd(), to: saoPauloYmd() },
              { label: '7 dias', from: addDaysYmd(saoPauloYmd(), -6), to: saoPauloYmd() },
              { label: '30 dias', from: addDaysYmd(saoPauloYmd(), -29), to: saoPauloYmd() },
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
              <input
                type="date"
                value={salesFrom}
                onChange={(e) => setSalesFrom(e.target.value)}
                required
              />
            </label>
            <label className="admin-date-field">
              Até
              <input
                type="date"
                value={salesTo}
                onChange={(e) => setSalesTo(e.target.value)}
                required
              />
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
          {salesReport ? (
            <>
              <div className="admin-kpi-lite-grid">
                <div className="admin-kpi-lite">
                  <div className="admin-kpi-lite__label">Pedidos pagos</div>
                  <div className="admin-kpi-lite__value">{salesReport.summary.orderCount}</div>
                </div>
                <div className="admin-kpi-lite">
                  <div className="admin-kpi-lite__label">Receita</div>
                  <div className="admin-kpi-lite__value">{brl(salesReport.summary.revenue)}</div>
                </div>
                <div className="admin-kpi-lite">
                  <div className="admin-kpi-lite__label">Ticket médio</div>
                  <div className="admin-kpi-lite__value">{brl(salesReport.summary.averageTicket)}</div>
                </div>
              </div>
              <AdminSalesCharts
                from={salesReport.from}
                to={salesReport.to}
                byDay={salesReport.byDay}
                topProducts={salesReport.topProducts}
                byPaymentMethod={salesReport.byPaymentMethod}
              />
              <div className="admin-split">
                <section className="admin-card-pro" style={{ marginBottom: 0 }}>
                  <div className="body">
                  <h3>Por status</h3>
                  {Object.keys(salesReport.byStatus).length ? (
                    <div className="admin-stat-list">
                      {Object.entries(salesReport.byStatus)
                        .sort((a, b) => b[1] - a[1])
                        .map(([st, count]) => (
                          <div key={st} className="admin-stat-row">
                            <span>{orderStatusLabel(st)}</span>
                            <b>{count}</b>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="admin-empty">Nenhum pedido no período.</p>
                  )}
                  </div>
                </section>
                <section className="admin-card-pro" style={{ marginBottom: 0 }}>
                  <div className="body">
                  <h3>Mais vendidos</h3>
                  {salesReport.topProducts.length ? (
                    <div className="admin-stat-list">
                      {salesReport.topProducts.map((tp) => (
                        <div key={tp.productId} className="admin-stat-row">
                          <span style={{ flex: 1, minWidth: 120 }}>{tp.name}</span>
                          <span className="admin-dense-row__meta">{tp.qty} un.</span>
                          <b>{brl(tp.revenue)}</b>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="admin-empty">Sem vendas pagas no período.</p>
                  )}
                  </div>
                </section>
              </div>
              <div className="admin-split" style={{ marginTop: 16 }}>
                <section className="admin-card-pro" style={{ marginBottom: 0 }}>
                  <div className="body">
                  <h3>Por dia</h3>
                  {(salesReport.byDay?.length ?? 0) ? (
                    <div className="admin-stat-list" style={{ maxHeight: 260, overflow: 'auto' }}>
                      {salesReport.byDay!.map((d) => (
                        <div key={d.date} className="admin-stat-row">
                          <span style={{ flex: 1, minWidth: 100 }}>
                            {new Date(`${d.date}T12:00:00-03:00`).toLocaleDateString('pt-BR')}
                          </span>
                          <span className="admin-dense-row__meta">{d.orderCount} ped.</span>
                          <b>{brl(d.revenue)}</b>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="admin-empty">Sem vendas pagas no período.</p>
                  )}
                  </div>
                </section>
                <section className="admin-card-pro" style={{ marginBottom: 0 }}>
                  <div className="body">
                  <h3>Por vendedor</h3>
                  {(salesReport.bySeller?.length ?? 0) ? (
                    <div className="admin-stat-list">
                      {salesReport.bySeller!.map((s) => (
                        <div key={s.sellerId ?? 'loja'} className="admin-stat-row">
                          <span style={{ flex: 1, minWidth: 120 }}>
                            {s.sellerName}
                            {!s.sellerId ? (
                              <AdminStatusChip label="própria" tone="accent" />
                            ) : null}
                          </span>
                          <span className="admin-dense-row__meta">{s.itemQty} un. · {s.orderCount} ped.</span>
                          <b>{brl(s.revenue)}</b>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="admin-empty">
                      Sem itens de vendas pagas (marketplace) no período.
                    </p>
                  )}
                  </div>
                </section>
              </div>
            </>
          ) : salesBusy ? (
            <p className="admin-empty">Carregando relatório…</p>
          ) : null}

      </div>
    </>
  );
}
