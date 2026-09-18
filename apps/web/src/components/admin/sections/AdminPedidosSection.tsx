'use client';

import Link from 'next/link';
import { brl } from '@/lib/api';
import {
  orderStatusLabel,
  adminQueueBucketLabel,
  POST_PAYMENT_OPS_HINT,
  isPostPaidStatus,
  nextFulfillmentStatus,
} from '@/lib/order-status';
import { isPlaceholderImageUrl } from '@/lib/placeholder-image';
import { rewritePublicUploadUrl } from '@/lib/public-upload-url';
import { shouldServerOrderSearch } from '@/lib/admin-order-search';
import {
  emptyOrdersQueueMessage,
  paymentMethodBadge,
  storeNotifyCardHint,
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
  ORDER_STATUS_TABS,
  PAID_STUCK_HOURS_UI,
  availableStock,
  customerHint,
  customerPhone,
  formatStuckHours,
  isPaidStuckOrder,
  hoursSincePaid,
  advanceButtonLabel,
  orderWa,
} from '@/components/admin/admin-console-model';

export function AdminPedidosSection() {
  const {
    orders,
    busyId,
    orderStatusFilter,
    openOrderId,
    setOpenOrderId,
    ops,
    orderJumpQ,
    setOrderJumpQ,
    orderSearchBusy,
    orderServerSearchActive,
    orderRoiFilter,
    setOrderRoiFilter,
    selectedOrderIds,
    setSelectedOrderIds,
    bulkBusy,
    bulkProgress,
    loadOps,
    selectOpsBucket,
    openCustomer,
    filteredOrders,
    bulkSepararEligibleCount,
    bulkAdvanceEligibleCount,
    advance,
    runBulkFulfillment,
    resendStorePaidNotify,
    copyOrderField,
  } = useAdminConsole();
  return (
    <>
      <div className="admin-section-panel admin-pedidos">
      <h3 id="admin-orders-queue" className="admin-section-heading">
        Pedidos ({filteredOrders.length}{orderJumpQ.trim() ? ` / ${orders.length}` : ''})
      </h3>
      {(() => {
        const awaiting =
          ops?.paidAwaitingOrg?.paidAwaitingCount ?? ops?.orders?.buckets?.paid ?? 0;
        const stuck = ops?.paidAwaitingOrg?.stuckCount ?? 0;
        const tone = paidQueueBannerTone({
          paidAwaitingCount: awaiting,
          stuckCount: stuck,
        });
        return (
          <div className={paidQueueBannerClass(tone)}>
            <div className="body">
              <div style={{ flex: 1, minWidth: 200 }}>
                <span className="admin-queue-banner__title">
                  {tone === 'empty' ? 'Fila Pagos' : 'Pagos aguardando organização'}
                </span>
                <div className="admin-queue-banner__meta">
                  {tone === 'empty' ? (
                    <>
                      Nenhum pedido em Pago aguardando Separar agora. Quando um PIX/cartão confirmar,
                      aparece aqui.
                    </>
                  ) : (
                    <>
                      {awaiting} pedido(s) em Pago
                      {stuck > 0
                        ? ` · ${stuck} travado(s) ≥${ops?.paidAwaitingOrg?.stuckHoursThreshold ?? PAID_STUCK_HOURS_UI}h`
                        : ` · nenhum acima de ${ops?.paidAwaitingOrg?.stuckHoursThreshold ?? PAID_STUCK_HOURS_UI}h`}
                      {ops?.paidAwaitingOrg?.oldestStuckHours != null
                        ? ` · mais antigo ~${ops.paidAwaitingOrg.oldestStuckHours}h`
                        : ''}
                    </>
                  )}
                </div>
                {ops?.paidAwaitingOrg?.stuckPublicIds?.length ? (
                  <div style={{ fontSize: 12, marginTop: 4, opacity: 0.9 }}>
                    IDs travados: {ops.paidAwaitingOrg.stuckPublicIds.join(', ')}
                  </div>
                ) : null}
              </div>
              {tone === 'empty' ? (
                <button
                  type="button"
                  className="btn ghost admin-btn-accent"
                  onClick={() => {
                    void loadOps();
                    selectOpsBucket('paid');
                  }}
                  style={{ minHeight: 44 }}
                >
                  Atualizar / ver Pagos
                </button>
              ) : (
                <button
                  type="button"
                  className="btn admin-btn-primary-accent"
                  onClick={() => selectOpsBucket('paid')}
                  style={{ minHeight: 44, minWidth: 44 }}
                >
                  Abrir fila Pagos
                </button>
              )}
            </div>
          </div>
        );
      })()}
      <p className="admin-pedidos__intro">
        Fila operacional (entrega própria): Aguardando pagamento → Pago → Organizando → Embalagem →
        Pronto para coleta → Em trânsito → Entregue. Bucket Problemas = histórico (cancelado/reembolsado)
        + legado stuck (separando/saiu). Alerta crítico do Ops conta só o legado travado.
        “Separar” = Organizando / Embalagem (sem status novo). Ao marcar Em trânsito, informe o rastreio (opcional).
        Seleção em lote: Separar agora (Pago → Organizando) e Avançar só nas transições de um clique já existentes.
        Pronto para coleta → Em trânsito continua individual (rastreio). WhatsApp é wa.me — não envia sozinho.
      </p>
      <div className="admin-pedidos__toolbar">
      <label className="admin-search-field">
        <span>
          Busca pedidos (servidor se ≥3 caracteres ou SCH-…; senão na lista carregada)
          {orderSearchBusy ? ' — buscando…' : orderServerSearchActive ? ' — busca no servidor' : ''}
        </span>
        <input
          value={orderJumpQ}
          onChange={(e) => setOrderJumpQ(e.target.value)}
          placeholder="Ex.: SCH-…, e-mail ou nome do cliente"
          aria-label="Busca de pedidos"
        />
      </label>
      <div className="admin-filter-row">
        {(
          [
            { key: 'all', label: 'Filtro ROI: todos' },
            { key: 'stuck_paid', label: 'Pagos travados (≥24h)' },
            { key: 'no_shipping', label: 'Sem frete/rastreio (pago→pronto)' },
          ] as const
        ).map((f) => (
          <button
            key={f.key}
            type="button"
            className={`admin-filter-chip${orderRoiFilter === f.key ? ' is-active' : ''}`}
            onClick={() => {
              setOrderRoiFilter(f.key);
              if (f.key === 'stuck_paid') selectOpsBucket('paid');
            }}
          >
            {f.label}
            {f.key === 'stuck_paid' && ops?.paidAwaitingOrg?.stuckCount != null
              ? ` (${ops.paidAwaitingOrg.stuckCount})`
              : ''}
          </button>
        ))}
      </div>
      <p className="ok" style={{ fontSize: 13, margin: 0 }}>
        {POST_PAYMENT_OPS_HINT}
      </p>
      <div className="admin-filter-row">
        {ORDER_STATUS_TABS.map((tab) => {
          const active = orderStatusFilter === tab.key;
          const opsCount =
            tab.key === ''
              ? ops?.orders?.total
              : ops?.orders?.buckets?.[tab.key];
          const listCount =
            tab.key === ''
              ? orders.length
              : tab.key === 'problems'
                ? orders.length
                : orders.filter((o) => o.status === tab.key).length;
          const count = active
            ? listCount
            : opsCount != null
              ? opsCount
              : null;
          return (
            <button
              key={tab.key || 'all'}
              type="button"
              className={`admin-filter-chip${active ? ' is-active' : ''}`}
              onClick={() => selectOpsBucket(tab.key)}
            >
              {tab.label}
              {count != null ? ` (${count})` : ''}
            </button>
          );
        })}
      </div>
      <div className="admin-filter-row">
        <button
          type="button"
          className="admin-filter-chip"
          disabled={bulkBusy || !filteredOrders.length}
          onClick={() =>
            setSelectedOrderIds(
              filteredOrders.every((o) => selectedOrderIds.includes(o.id))
                ? []
                : filteredOrders.map((o) => o.id),
            )
          }
        >
          {filteredOrders.length && filteredOrders.every((o) => selectedOrderIds.includes(o.id))
            ? 'Limpar visíveis'
            : `Selecionar visíveis (${filteredOrders.length})`}
        </button>
        <button
          type="button"
          className="admin-filter-chip"
          disabled={bulkBusy || !filteredOrders.some((o) => isBulkSepararEligible(o.status))}
          onClick={() => setSelectedOrderIds(selectVisibleEligibleIds(filteredOrders, 'separar'))}
        >
          Selecionar pagos ({filteredOrders.filter((o) => isBulkSepararEligible(o.status)).length})
        </button>
        <button
          type="button"
          className="admin-filter-chip"
          disabled={bulkBusy || !filteredOrders.some((o) => isBulkAdvanceEligible(o.status))}
          onClick={() => setSelectedOrderIds(selectVisibleEligibleIds(filteredOrders, 'advance'))}
        >
          Selecionar avançáveis ({filteredOrders.filter((o) => isBulkAdvanceEligible(o.status)).length})
        </button>
      </div>
      </div>
      {selectedOrderIds.length ? (
        <div className="admin-bulk-bar" role="region" aria-label="Ações em lote">
          <span className="admin-bulk-bar__count">{selectedOrderIds.length} selecionado(s)</span>
          <span className="admin-bulk-bar__hint">
            {bulkProgress ||
              `Separar agora: ${bulkSepararEligibleCount} · Avançar (um clique): ${bulkAdvanceEligibleCount}. Falhas aparecem aqui — nada silencioso.`}
          </span>
          <button
            type="button"
            className="btn admin-btn-separar"
            disabled={bulkBusy || bulkSepararEligibleCount === 0}
            onClick={() => void runBulkFulfillment('separar')}
            title="Pago → Organizando, mesma transição do botão da linha"
          >
            {bulkBusy ? bulkProgress || 'Separando…' : `Separar agora (${bulkSepararEligibleCount})`}
          </button>
          <button
            type="button"
            className="btn admin-btn-primary-accent"
            disabled={bulkBusy || bulkAdvanceEligibleCount === 0}
            onClick={() => void runBulkFulfillment('advance')}
            title="Avança cada pedido ao próximo status de um clique (sem rastreio)"
          >
            Avançar status ({bulkAdvanceEligibleCount})
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={bulkBusy}
            onClick={() => setSelectedOrderIds([])}
            style={{ borderColor: '#ffd100', color: '#ffd100' }}
          >
            Limpar
          </button>
        </div>
      ) : null}
      <div className="admin-order-list">
      {filteredOrders.map((o) => {
        const next = nextFulfillmentStatus(o.status);
        const wa = orderWa(o, 'generic');
        const waPaid = orderWa(o, 'paid');
        const waShipped = orderWa(o, 'shipped');
        const showEarlyPaidOps =
          o.status === 'paid' || o.status === 'organizing' || o.status === 'separating';
        const canResendStorePaidNotify = isPostPaidStatus(o.status);
        const open = openOrderId === o.id;
        const phone = customerPhone(o);
        const stuck = isPaidStuckOrder(o);
        const sticky = shouldStickyOrderActions(o.status);
        const selected = selectedOrderIds.includes(o.id);
        const cardMod =
          stuck ? ' admin-order-card--stuck' : o.status === 'paid' ? ' admin-order-card--paid' : '';
        const payBadge = paymentMethodBadge(o.payments);
        const needsSepararStyle =
          o.status === 'paid' ||
          o.status === 'organizing' ||
          o.status === 'separating' ||
          stuck;
        return (
          <div key={o.id} className={`admin-order-card${cardMod}${selected ? ' is-selected' : ''}`}>
            <div className="admin-order-card__body">
              <div className="admin-order-card__top">
                <div className="admin-order-card__main">
                  <div className="admin-order-card__id-row">
                    <label className="admin-select-hit">
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={bulkBusy}
                        onChange={() => setSelectedOrderIds((prev) => toggleIdInList(prev, o.id))}
                        aria-label={`Selecionar ${o.publicId}`}
                      />
                    </label>
                    <span className="admin-order-card__public-id">{o.publicId}</span>
                    <button
                      type="button"
                      className="btn ghost admin-btn-ghost-pro"
                      onClick={() => void copyOrderField('publicId', o.publicId)}
                      title="Copiar publicId"
                      aria-label={`Copiar ${o.publicId}`}
                      style={{ padding: '6px 10px', minHeight: 36, fontSize: 12 }}
                    >
                      Copiar ID
                    </button>
                    {payBadge ? (
                      <AdminStatusChip
                        label={`${payBadge.label}${payBadge.amount != null ? ` · ${brl(payBadge.amount)}` : ''}`}
                        tone={payBadge.kind === 'pix' ? 'ok' : 'info'}
                        title={payBadge.status ? `status ${payBadge.status}` : undefined}
                        className={
                          payBadge.kind === 'pix'
                            ? 'admin-chip-status--pay-pix'
                            : payBadge.kind === 'card'
                              ? 'admin-chip-status--pay-card'
                              : undefined
                        }
                      />
                    ) : null}
                    <AdminOrderStatusChip status={o.status} label={orderStatusLabel(o.status)} />
                    {o.status === 'paid' ? (
                      <AdminStatusChip
                        label={
                          stuck
                            ? `Travado ${formatStuckHours(hoursSincePaid(o))}`
                            : `Aguardando org. · ${formatStuckHours(hoursSincePaid(o))}`
                        }
                        tone={stuck ? 'danger' : 'accent'}
                      />
                    ) : null}
                  </div>
                  <div className="admin-order-card__meta">
                    {orderStatusLabel(o.status)}{' '}
                    <span style={{ opacity: 0.6 }}>({o.status})</span>
                    {next ? (
                      <span style={{ marginLeft: 6 }}>
                        → próximo: <b>{orderStatusLabel(next)}</b>
                      </span>
                    ) : null}
                  </div>
                  <div className="admin-order-card__meta">
                    {brl(o.total)} · {customerHint(o)}
                    {o.items?.length ? ` · ${o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}` : ''}
                    {o.user?.id ? (
                      <>
                        {' · '}
                        <button
                          type="button"
                          className="admin-link-btn"
                          onClick={() => void openCustomer(o.user!.id)}
                        >
                          {customerVerClienteLabel(true)}
                        </button>
                      </>
                    ) : null}
                  </div>
                  <div className="admin-order-card__meta" style={{ fontSize: 12, marginTop: 2 }}>
                    Pagamento:{' '}
                    {o.payments?.length
                      ? o.payments.map((p) => `${p.status}${p.method ? `/${p.method}` : ''}`).join(', ')
                      : '—'}
                    {' · '}
                    Frete:{' '}
                    {o.freightSnap?.label ||
                      (o.freight != null ? brl(Number(o.freight)) : '—')}
                    {o.trackingCode ? ` · Rastreio ${o.trackingCode}` : ''}
                    {o.createdAt
                      ? ` · criado ${new Date(o.createdAt).toLocaleString('pt-BR')}`
                      : ''}
                  </div>
                </div>
                <div
                  className={`admin-order-card__actions${sticky ? ' is-sticky' : ''}`}
                >
                  <button
                    type="button"
                    className="btn ghost admin-btn-ghost-pro"
                    onClick={() => setOpenOrderId(open ? null : o.id)}
                  >
                    {open ? 'Fechar' : 'Detalhe'}
                  </button>
                  {next ? (
                    <button
                      className={`btn${needsSepararStyle ? ' admin-btn-separar' : ''}`}
                      disabled={busyId === o.id || bulkBusy}
                      onClick={() => advance(o)}
                      title={`Avançar para ${orderStatusLabel(next)}`}
                      style={needsSepararStyle ? undefined : { minHeight: 44, minWidth: 44 }}
                    >
                      {busyId === o.id ? 'Salvando...' : advanceButtonLabel(o.status, next)}
                    </button>
                  ) : (
                    <AdminOrderStatusChip status={o.status} label={orderStatusLabel(o.status)} />
                  )}
                </div>
              </div>

              {canResendStorePaidNotify ? (
                <div className="admin-order-card__ops ok">
                  {showEarlyPaidOps ? (
                    <span>
                      Cliente pagou — próximo ops: Separar (Organizando) — não é automático.
                      {o.status === 'paid' && stuck
                        ? ` Pedido travado há ${formatStuckHours(hoursSincePaid(o))}.`
                        : ''}{' '}
                      Avisar no WhatsApp (e-mail já cobre o cliente, se mail estiver ativo).
                    </span>
                  ) : null}
                  <span className="muted" style={{ fontSize: 13 }}>
                    {storeNotifyCardHint({
                      statusLabel: orderStatusLabel(o.status),
                      publicId: o.publicId,
                      mail: ops?.mail,
                    })}
                  </span>
                  {showEarlyPaidOps ? (
                    <a
                      className="btn wa"
                      href={waPaid.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
                      title={waPaid.toCustomer ? 'Abre wa.me com o cliente' : 'Cliente sem telefone — wa.me da loja'}
                    >
                      {whatsAppOpsButtonLabel(waPaid.toCustomer, 'paid')}
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className="btn ghost admin-btn-ghost-pro"
                    disabled={busyId === o.id || bulkBusy}
                    onClick={() => void resendStorePaidNotify(o)}
                    title="POST /admin/orders/:id/notify-paid"
                  >
                    Reenviar aviso loja
                  </button>
                </div>
              ) : null}

              <div className="admin-order-card__wa-row">
                <a
                  className="btn wa"
                  href={wa.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
                  title={wa.toCustomer ? 'Abre wa.me com o cliente' : 'Cliente sem telefone — wa.me da loja'}
                >
                  {whatsAppOpsButtonLabel(wa.toCustomer, 'generic')}
                </a>
                {o.status === 'in_transit' || o.status === 'shipped' ? (
                  <a
                    className="btn wa"
                    href={waShipped.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
                  >
                    {whatsAppOpsButtonLabel(waShipped.toCustomer, 'shipped')}
                  </a>
                ) : null}
              </div>
              <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>
                {wa.toCustomer
                  ? `Abre conversa com o cliente (${phone}).`
                  : 'Cliente sem telefone — abre o WhatsApp da loja (NEXT_PUBLIC_WHATSAPP) com rascunho interno.'}
              </p>

              {open ? (
                <div className="admin-order-card__detail">
                  <div className="row" style={{ flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    <span>
                      <b>publicId:</b> {o.publicId}{' '}
                      <span style={{ opacity: 0.7 }}>(id {o.id})</span>
                    </span>
                    <button
                      type="button"
                      className="btn ghost admin-btn-ghost-pro"
                      onClick={() => void copyOrderField('publicId', o.publicId)}
                      style={{ padding: '6px 10px', minHeight: 36, fontSize: 12 }}
                    >
                      Copiar ID
                    </button>
                  </div>
                  <div><b>Cliente:</b> {o.user?.name || '—'}</div>
                  <div><b>E-mail:</b> {o.user?.email || '—'}</div>
                  <div><b>WhatsApp:</b> {phone || 'não cadastrado'}</div>
                  {o.user?.id ? (
                    <button
                      type="button"
                      className="btn ghost admin-btn-ghost-pro"
                      onClick={() => void openCustomer(o.user!.id)}
                    >
                      {customerVerClienteLabel(true)}
                    </button>
                  ) : null}
                  {o.addressSnap?.city ? (
                    <div>
                      <b>Entrega:</b>{' '}
                      {o.addressSnap.label ? `${o.addressSnap.label} · ` : ''}
                      {o.addressSnap.city}/{o.addressSnap.uf}
                    </div>
                  ) : null}
                  <div className="row" style={{ flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    <span>
                      <b>Rastreio:</b>{' '}
                      {o.trackingCode || '—'}
                      {o.carrier ? ` · ${o.carrier}` : ''}
                    </span>
                    {o.trackingCode?.trim() ? (
                      <button
                        type="button"
                        className="btn ghost admin-btn-ghost-pro"
                        onClick={() => void copyOrderField('tracking', o.trackingCode || '')}
                        style={{ padding: '6px 10px', minHeight: 36, fontSize: 12 }}
                      >
                        Copiar rastreio
                      </button>
                    ) : null}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <b>Pagamento(s):</b>
                    {o.payments?.length ? (
                      <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                        {o.payments.map((pay) => (
                          <li key={pay.id}>
                            {pay.status}
                            {pay.method ? ` · ${pay.method}` : ''}
                            {pay.provider ? ` · ${pay.provider}` : ''}
                            {pay.externalId ? ` · ext ${pay.externalId}` : ''}
                            {pay.amount != null ? ` · ${brl(Number(pay.amount))}` : ''}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span> — (nenhum registro na API)</span>
                    )}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <b>Frete / envio:</b>{' '}
                    {o.freightSnap?.label || '—'}
                    {o.freight != null ? ` · ${brl(Number(o.freight))}` : ''}
                    {o.freightSnap?.estimatedDays != null
                      ? ` · ~${o.freightSnap.estimatedDays} dia(s)`
                      : ''}
                    {o.carrier ? ` · carrier ${o.carrier}` : ''}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <b>Histórico:</b>
                    {o.statusHistory?.length ? (
                      <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                        {o.statusHistory.map((h) => (
                          <li key={h.id}>
                            {h.fromStatus ? `${h.fromStatus} → ` : ''}
                            {h.toStatus}
                            {' · '}
                            {new Date(h.createdAt).toLocaleString('pt-BR')}
                            {h.note ? ` · ${h.note}` : ''}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span>
                        {' '}
                        — (sem histórico; criado{' '}
                        {o.createdAt
                          ? new Date(o.createdAt).toLocaleString('pt-BR')
                          : '—'}
                        )
                      </span>
                    )}
                  </div>
                  {o.status === 'paid' ? (
                    <div style={{ marginTop: 8, color: stuck ? 'var(--admin-danger)' : undefined }}>
                      <b>Tempo em pago:</b>{' '}
                      {formatStuckHours(hoursSincePaid(o))}
                      {stuck
                        ? ` — acima de ${PAID_STUCK_HOURS_UI}h (travado)`
                        : ` (limite alerta ${PAID_STUCK_HOURS_UI}h)`}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
      {!filteredOrders.length ? (
        <p className="muted">
          {emptyOrdersQueueMessage({
            hasSearch: Boolean(orderJumpQ.trim()),
            roiFilter: orderRoiFilter,
            statusFilter: orderStatusFilter,
            paidBucketLabel: orderStatusFilter
              ? adminQueueBucketLabel(orderStatusFilter)
              : undefined,
          })}
        </p>
      ) : null}
      </div>
      </div>
    </>
  );
}
