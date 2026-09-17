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
  availableStock,
  customerHint,
  formatStuckHours,
  isPaidStuckOrder,
  hoursSincePaid,
  advanceButtonLabel,
  orderWa,
} from '@/components/admin/admin-console-model';

export function AdminClientesSection() {
  const {
    orders,
    form,
    customers,
    customersTotal,
    customerQ,
    setCustomerQ,
    customerBusy,
    customerDetail,
    customerDetailBusy,
    loadCustomers,
    openCustomer,
    closeCustomer,
    openPedidoFromCustomer,
  } = useAdminConsole();
  return (
    <>
      <div className="admin-section-panel admin-crm-panel">
      <p className="admin-section-intro">
        CRM leve, somente leitura: cadastro, endereço, total pago e histórico real de pedidos.
        Sem edição, exclusão ou automação de marketing.
      </p>
      <div className="admin-toolbar admin-crm-toolbar">
          <form
            className="admin-toolbar__row"
            onSubmit={(e) => {
              e.preventDefault();
              void loadCustomers(customerQ);
            }}
          >
            <label className="admin-search-field" style={{ flex: 1, minWidth: 200, maxWidth: 'none' }}>
              <span>Buscar (nome, e-mail ou telefone)</span>
              <input
                value={customerQ}
                onChange={(e) => setCustomerQ(e.target.value)}
                placeholder="Ex.: Maria ou 5199…"
              />
            </label>
            <button className="btn admin-btn-primary-accent" type="submit" disabled={customerBusy}>
              {customerBusy ? 'Buscando…' : 'Buscar'}
            </button>
            <button
              className="btn ghost admin-btn-ghost-pro"
              type="button"
              disabled={customerBusy}
              onClick={() => {
                setCustomerQ('');
                void loadCustomers('');
              }}
            >
              Limpar
            </button>
          </form>
          <div className="admin-dense-row__meta">
            {customersTotal} cliente(s) · mostrando {customers.length}
            {customerDetail ? ` · aberto: ${customerDetail.name}` : ''}
          </div>
      </div>
      <div className="admin-crm-layout">
      <div className="admin-crm-list">
      <div className="admin-dense-list">
            {customers.map((c) => {
              const selected = customerDetail?.id === c.id;
              const cityUf = formatCustomerCityUf(c);
              return (
              <div
                key={c.id}
                className={`admin-dense-row${selected ? ' is-selected' : ''}`}
              >
                <div className="admin-dense-row__main">
                  <div className="admin-dense-row__title">
                    <b>{c.name}</b>
                    <AdminStatusChip
                      label={customerAccountLabel(c.status)}
                      tone={customerAccountTone(c.status)}
                    />
                  </div>
                  <div className="admin-dense-row__meta">
                    {c.email}
                    {c.phone ? ` · ${c.phone}` : ''}
                    {cityUf ? ` · ${cityUf}` : ''}
                  </div>
                  <div className="admin-dense-row__meta">
                    {c.ordersCount} pedido(s) · pagos {c.paidOrdersCount} · {brl(c.paidTotal)}
                    {c.lastOrderAt
                      ? ` · último ${formatAdminDate(c.lastOrderAt)}`
                      : ''}
                  </div>
                </div>
                <div className="admin-dense-row__actions">
                <button
                  type="button"
                  className="btn ghost admin-btn-ghost-pro"
                  disabled={customerDetailBusy}
                  onClick={() => void openCustomer(c.id)}
                >
                  {selected ? 'Atualizar' : 'Ver histórico'}
                </button>
                </div>
              </div>
              );
            })}
            {!customers.length ? (
              <p className="admin-empty">{customerHistoryEmptyMessage(Boolean(customerQ.trim()))}</p>
            ) : null}
      </div>
      </div>
          {customerDetail ? (
            <div id="admin-customer-detail" className="admin-detail-panel admin-crm-detail">
              <div className="admin-crm-detail__head">
                <h3 style={{ margin: 0 }}>
                  {customerDetail.name}{' '}
                  <AdminStatusChip
                    label={customerAccountLabel(customerDetail.status)}
                    tone={customerAccountTone(customerDetail.status)}
                  />
                </h3>
                <button type="button" className="btn ghost admin-btn-ghost-pro" onClick={closeCustomer}>
                  Fechar
                </button>
              </div>
              <div className="admin-crm-fields">
                <div className="admin-crm-field">
                  <span className="admin-crm-field__label">E-mail</span>
                  <span className="admin-crm-field__value">{customerDetail.email || '—'}</span>
                </div>
                <div className="admin-crm-field">
                  <span className="admin-crm-field__label">Telefone</span>
                  <span className="admin-crm-field__value">{customerDetail.phone || '—'}</span>
                </div>
                <div className="admin-crm-field">
                  <span className="admin-crm-field__label">Cliente desde</span>
                  <span className="admin-crm-field__value">{formatAdminDate(customerDetail.createdAt)}</span>
                </div>
                <div className="admin-crm-field">
                  <span className="admin-crm-field__label">Pedidos</span>
                  <span className="admin-crm-field__value">{customerDetail.ordersCount}</span>
                </div>
                <div className="admin-crm-field">
                  <span className="admin-crm-field__label">Pagos</span>
                  <span className="admin-crm-field__value">{customerDetail.paidOrdersCount}</span>
                </div>
                <div className="admin-crm-field">
                  <span className="admin-crm-field__label">Total pago</span>
                  <span className="admin-crm-field__value">{brl(customerDetail.paidTotal)}</span>
                </div>
                <div className="admin-crm-field">
                  <span className="admin-crm-field__label">Último pedido</span>
                  <span className="admin-crm-field__value">{formatAdminDate(customerDetail.lastOrderAt)}</span>
                </div>
                <div className="admin-crm-field">
                  <span className="admin-crm-field__label">Último pago</span>
                  <span className="admin-crm-field__value">{formatAdminDate(customerDetail.lastPaidAt)}</span>
                </div>
                <div className="admin-crm-field">
                  <span className="admin-crm-field__label">SCHIMITZ+</span>
                  <span className="admin-crm-field__value">{brl(customerDetail.cashbackBalance)}</span>
                </div>
              </div>
              <div className="admin-crm-addresses">
                <h4 className="admin-crm-subhead">Endereço</h4>
                {(customerDetail.addresses || []).length ? (
                  <ul className="admin-crm-address-list">
                    {(customerDetail.addresses || []).map((a, idx) => (
                      <li key={a.id || `${a.cep}-${idx}`}>
                        {a.isDefault ? <AdminStatusChip label="Padrão" tone="accent" /> : null}
                        {a.label ? <b>{a.label}</b> : null}
                        {' '}
                        {formatCustomerAddressLine(a) || '—'}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="admin-dense-row__meta" style={{ marginTop: 0 }}>
                    Nenhum endereço cadastrado
                    {formatCustomerCityUf(customerDetail)
                      ? ` · cidade no pedido: ${formatCustomerCityUf(customerDetail)}`
                      : '.'}
                  </p>
                )}
              </div>
              <h4 className="admin-crm-subhead">
                Histórico de pedidos
                {customerDetail.orders.length
                  ? ` (${customerDetail.orders.length}${
                      customerDetail.ordersCount > customerDetail.orders.length
                        ? ` de ${customerDetail.ordersCount}`
                        : ''
                    })`
                  : ''}
              </h4>
              <div className="admin-dense-list admin-crm-history">
                {customerDetail.orders.map((o) => (
                  <div key={o.id} className="admin-dense-row admin-crm-order">
                    <div className="admin-dense-row__main">
                      <div className="admin-dense-row__title">
                        <span className="admin-dense-row__code">{o.publicId}</span>
                        <AdminOrderStatusChip status={o.status} label={orderStatusLabel(o.status)} />
                        {o.paymentMethod ? (
                          <AdminStatusChip
                            label={customerOrderPaymentLabel(o.paymentMethod)}
                            tone={o.paymentMethod === 'pix' ? 'ok' : 'info'}
                            title={o.paymentStatus ? `status ${o.paymentStatus}` : undefined}
                          />
                        ) : null}
                      </div>
                      <div className="admin-dense-row__meta">
                        {brl(o.total)}
                        {o.freight ? ` · frete ${brl(o.freight)}` : ''}
                        {o.discount ? ` · desc. ${brl(o.discount)}` : ''}
                        {' · '}
                        {formatAdminDateTime(o.createdAt)}
                      </div>
                      <div className="admin-dense-row__meta">
                        {o.items.map((it) => `${it.qty}× ${it.name}`).join(', ')}
                      </div>
                    </div>
                    <div className="admin-dense-row__actions">
                      <button
                        type="button"
                        className="btn ghost admin-btn-ghost-pro"
                        onClick={() => openPedidoFromCustomer(o.id)}
                      >
                        Ver pedido
                      </button>
                    </div>
                  </div>
                ))}
                {!customerDetail.orders.length ? (
                  <p className="admin-empty">{customerOrdersEmptyMessage()}</p>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="admin-detail-panel admin-crm-detail admin-crm-detail--empty">
              <p className="admin-empty" style={{ margin: 0 }}>
                Selecione um cliente para ver cadastro, endereço e histórico real de pedidos.
              </p>
            </div>
          )}
      </div>

      </div>
    </>
  );
}
