'use client';

import { useState } from 'react';
import Link from 'next/link';
import { brl } from '@/lib/api';
import {
  orderStatusLabel,
  adminQueueBucketLabel,
  POST_PAYMENT_OPS_HINT,
  isPostPaidStatus,
  nextFulfillmentStatus,
  ADMIN_ORDER_QUEUE_BUCKETS,
} from '@/lib/order-status';
import { isPlaceholderImageUrl } from '@/lib/placeholder-image';
import { rewritePublicUploadUrl } from '@/lib/public-upload-url';
import { shouldServerOrderSearch } from '@/lib/admin-order-search';
import {
  emptyOrdersQueueMessage,
  formatOpsSnapshotTime,
  opsAlertCtaHintPt,
  opsCountOrDash,
  OPS_DO_HEADING,
  OPS_NOW_HEADING,
  partitionSectionAlerts,
  paymentMethodBadge,
  pedidosCommandCounts,
  pedidosNowSummary,
  pedidosQuickActionFigure,
  PEDIDOS_DO_LEDE,
  PEDIDOS_NOW_LEDE,
  PEDIDOS_QUICK_ACTIONS,
  storePaidNotifyCardHint,
  whatsAppOpsButtonLabel,
  type PedidosQuickActionId,
} from '@/lib/admin-ops-ui';
import { AdminAttentionStrip } from '@/components/admin/AdminAttentionStrip';
import { AdminOrderDossier } from '@/components/admin/AdminOrderDossier';
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
  PAID_STUCK_HOURS_UI,
  availableStock,
  customerHint,
  customerPhone,
  formatStuckHours,
  isPaidStuckOrder,
  hoursSincePaid,
  advanceButtonLabel,
  orderWa,
  type AdminOpsAlert,
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
    refundPayment,
    runBulkFulfillment,
    resendStorePaidNotify,
    copyOrderField,
    selectOpsAlert,
    err,
    msg,
    opsSnapshot,
    opsBusy,
  } = useAdminConsole();
  const ready = ops != null;
  const [confirmAdvance, setConfirmAdvance] = useState(false);
  const [refundPaymentId, setRefundPaymentId] = useState<string | null>(null);
  const [trackingDraft, setTrackingDraft] = useState('');
  const [carrierDraft, setCarrierDraft] = useState('');
  const openOrder = orders.find((order) => order.id === openOrderId) || null;

  function closeDossier() {
    setOpenOrderId(null);
    setConfirmAdvance(false);
    setRefundPaymentId(null);
  }

  function openDossier(orderId: string, order: (typeof orders)[number]) {
    setOpenOrderId(orderId);
    setConfirmAdvance(false);
    setRefundPaymentId(null);
    setTrackingDraft(order.trackingCode || '');
    setCarrierDraft(order.carrier || '');
  }

  function askAdvance(order: (typeof orders)[number]) {
    if (!nextFulfillmentStatus(order.status)) return;
    setOpenOrderId(order.id);
    setConfirmAdvance(true);
    setRefundPaymentId(null);
    setTrackingDraft(order.trackingCode || '');
    setCarrierDraft(order.carrier || 'propria');
  }

  function askRefund(paymentId: string) {
    setConfirmAdvance(false);
    setRefundPaymentId(paymentId);
  }

  async function confirmAdvanceNow() {
    if (!openOrder) return;
    const ok = await advance(openOrder, { trackingCode: trackingDraft, carrier: carrierDraft });
    if (ok) setConfirmAdvance(false);
  }

  async function confirmRefundNow(paymentId: string) {
    if (!openOrder) return;
    const ok = await refundPayment(openOrder, paymentId);
    if (ok) setRefundPaymentId(null);
  }
  const counts = pedidosCommandCounts(ops, ready);
  const sectionAlerts = partitionSectionAlerts(ops?.alerts, 'pedidos');
  const snapshotState = ops ? 'ready' : opsSnapshot;

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

  function runQuickAction(id: PedidosQuickActionId) {
    if (id === 'paid') {
      setOrderRoiFilter('all');
      selectOpsBucket('paid');
      return;
    }
    if (id === 'stuck') {
      setOrderRoiFilter('stuck_paid');
      selectOpsBucket('paid');
      return;
    }
    if (id === 'problems') {
      setOrderRoiFilter('all');
      selectOpsBucket('problems');
      return;
    }
    if (id === 'awaiting') {
      setOrderRoiFilter('all');
      selectOpsBucket('awaiting_payment');
      return;
    }
    setOrderRoiFilter('no_shipping');
    document.getElementById('admin-orders-queue')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function kpiTone(n: number | null, kind: 'warn' | 'danger'): string {
    if (!ready || n == null || n <= 0) return '';
    return kind === 'danger' ? ' admin-cc-kpi--danger' : ' admin-cc-kpi--warn';
  }

  return (
    <>
      <div className="admin-section-panel admin-pedidos admin-cc">
      <header className="admin-cc-banner">
        <div>
          <p className="admin-cc-banner__eyebrow">Pedidos</p>
          <p className="admin-cc-banner__title">Fila operacional, um snapshot.</p>
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
          disabled={opsBusy}
          onClick={() => void loadOps()}
        >
          {opsBusy ? 'Atualizando…' : 'Atualizar'}
        </button>
      </header>

      <section className="admin-cc-block" aria-labelledby="pedidos-now-heading">
        <p className="admin-cc-block__step">01</p>
        <h2 id="pedidos-now-heading" className="admin-cc-block__title">
          {OPS_NOW_HEADING}
        </h2>
        <p className="admin-cc-block__lede">{PEDIDOS_NOW_LEDE}</p>
        <p className="admin-cc-nowline" role="status">
          {pedidosNowSummary(counts, snapshotState)}
        </p>
        <div className="admin-cc-kpi-grid">
          <button
            type="button"
            className={`admin-cc-kpi${kpiTone(counts.stuckPaid, 'danger')}${
              ready && (counts.stuckPaid ?? 0) === 0 ? kpiTone(counts.paidAwaiting, 'warn') : ''
            }`}
            onClick={() => runQuickAction('paid')}
          >
            <div className="admin-cc-kpi__label">Pagos p/ organizar</div>
            <div className={`admin-cc-kpi__value${(counts.stuckPaid ?? 0) > 0 ? ' admin-cc-kpi__value--danger' : ''}`}>
              {opsCountOrDash(counts.paidAwaiting, ready)}
            </div>
            <div className="admin-cc-kpi__hint">
              {!ready
                ? 'aguardando snapshot'
                : counts.stuckPaid == null
                  ? 'travados —'
                  : counts.stuckPaid > 0
                    ? `${counts.stuckPaid} travado(s)${
                        counts.stuckHoursThreshold != null ? ` ≥${counts.stuckHoursThreshold}h` : ''
                      }`
                    : counts.stuckHoursThreshold != null
                      ? `limite ${counts.stuckHoursThreshold}h`
                      : '0 travado'}
            </div>
          </button>
          <button
            type="button"
            className={`admin-cc-kpi${kpiTone(counts.stuckPaid, 'danger')}`}
            onClick={() => runQuickAction('stuck')}
          >
            <div className="admin-cc-kpi__label">Pagos travados</div>
            <div className={`admin-cc-kpi__value${(counts.stuckPaid ?? 0) > 0 ? ' admin-cc-kpi__value--danger' : ''}`}>
              {opsCountOrDash(counts.stuckPaid, ready)}
            </div>
            <div className="admin-cc-kpi__hint">
              {!ready
                ? 'aguardando snapshot'
                : counts.oldestStuckHours != null
                  ? `mais antigo ~${counts.oldestStuckHours}h`
                  : counts.stuckPaid === 0
                    ? 'nenhum acima do limite'
                    : 'sem horas neste snapshot'}
            </div>
          </button>
          <button
            type="button"
            className={`admin-cc-kpi${kpiTone(counts.legacyStuck, 'danger')}`}
            onClick={() => runQuickAction('problems')}
          >
            <div className="admin-cc-kpi__label">Legado travado</div>
            <div className={`admin-cc-kpi__value${(counts.legacyStuck ?? 0) > 0 ? ' admin-cc-kpi__value--danger' : ''}`}>
              {opsCountOrDash(counts.legacyStuck, ready)}
            </div>
            <div className="admin-cc-kpi__hint">separando / saiu para entrega</div>
          </button>
          <button
            type="button"
            className={`admin-cc-kpi${kpiTone(counts.awaitingPayment, 'warn')}`}
            onClick={() => runQuickAction('awaiting')}
          >
            <div className="admin-cc-kpi__label">Aguardando pagamento</div>
            <div className="admin-cc-kpi__value">{opsCountOrDash(counts.awaitingPayment, ready)}</div>
            <div className="admin-cc-kpi__hint">bucket do snapshot</div>
          </button>
        </div>
        {counts.stuckPublicIds.length ? (
          <p className="admin-cc-work__note">IDs travados: {counts.stuckPublicIds.join(', ')}</p>
        ) : null}
        <p className="admin-cc-flow__label">Fila por status real — o clique filtra esta página</p>
        <div className="admin-cc-flow" role="list">
          <button
            type="button"
            role="listitem"
            className={`admin-cc-flow__step${orderStatusFilter === '' ? ' is-active' : ''}`}
            onClick={() => {
              setOrderRoiFilter('all');
              selectOpsBucket('');
            }}
          >
            <span>Todos</span>
            <strong>{opsCountOrDash(counts.total, ready)}</strong>
          </button>
          {ADMIN_ORDER_QUEUE_BUCKETS.map((key) => (
            <button
              key={key}
              type="button"
              role="listitem"
              className={`admin-cc-flow__step${orderStatusFilter === key ? ' is-active' : ''}${
                ready && key === 'problems' && (counts.legacyStuck ?? 0) > 0 ? ' is-hot' : ''
              }${ready && key === 'paid' && (counts.stuckPaid ?? 0) > 0 ? ' is-hot' : ''}`}
              onClick={() => {
                setOrderRoiFilter('all');
                selectOpsBucket(key);
              }}
            >
              <span>{adminQueueBucketLabel(key)}</span>
              <strong>{opsCountOrDash(counts.buckets ? counts.buckets[key] : null, ready)}</strong>
            </button>
          ))}
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
          const a = (ops?.alerts ?? []).find((x) => x.code === code);
          if (a) selectOpsAlert(a);
        }}
      />

      <section className="admin-cc-block" aria-labelledby="pedidos-do-heading">
        <p className="admin-cc-block__step">03</p>
        <h2 id="pedidos-do-heading" className="admin-cc-block__title">
          {OPS_DO_HEADING}
        </h2>
        <p className="admin-cc-block__lede">{PEDIDOS_DO_LEDE}</p>
        <div className="admin-cc-actions admin-cc-actions--sticky">
          {PEDIDOS_QUICK_ACTIONS.map((action) => {
            const figure = pedidosQuickActionFigure(action.id, counts);
            return (
              <button
                key={action.id}
                type="button"
                className="admin-cc-action"
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

      <section className="admin-cc-block" aria-labelledby="admin-orders-queue">
        <h2 id="admin-orders-queue" className="admin-cc-block__title">
          Fila carregada ({filteredOrders.length}
          {orderJumpQ.trim() ? ` / ${orders.length}` : ''})
        </h2>
        <p className="admin-cc-block__lede">
          Lista de GET /admin/orders com o status real de cada pedido. Os números da faixa acima são o
          snapshot. Separar continua Pago → Organizando e Organizando → Embalagem — sem status novo.
          Pronto para coleta → Em trânsito continua individual (rastreio). WhatsApp abre wa.me e não envia sozinho.
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
            { key: 'stuck_paid', label: `Pagos travados (≥${PAID_STUCK_HOURS_UI}h)` },
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
      {err ? (
        <p role="alert" className="alert admin-ent-banner admin-ent-banner--err">
          {err}
        </p>
      ) : null}
      {msg && !err ? (
        <p role="status" className="ok admin-ent-banner">
          {msg}
        </p>
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
          <div key={o.id} className={`admin-order-card${cardMod}${selected ? ' is-selected' : ''}${open ? ' is-open' : ''}`}>
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
                    onClick={() => (open ? closeDossier() : openDossier(o.id, o))}
                  >
                    {open ? 'Fechar' : 'Detalhe'}
                  </button>
                  {next ? (
                    <button
                      type="button"
                      className={`btn${needsSepararStyle ? ' admin-btn-separar' : ''}`}
                      disabled={busyId === o.id || bulkBusy}
                      onClick={() => askAdvance(o)}
                      title={`Confirmar avanço para ${orderStatusLabel(next)}`}
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
                  ) : (
                    <span className="muted" style={{ fontSize: 13 }}>
                      Pedido já pago ({orderStatusLabel(o.status)}) — reenviar aviso de venda à loja se o e-mail não chegou.
                    </span>
                  )}
                  {(() => {
                    const mailHint = storePaidNotifyCardHint({
                      orderPublicId: o.publicId,
                      lastFailure: ops?.mail?.lastStoreNotifyFailure,
                    });
                    return mailHint ? (
                      <span style={{ display: 'block', fontSize: 12, color: '#ffb4b4', marginTop: 4 }}>
                        {mailHint}
                      </span>
                    ) : null;
                  })()}
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
      {openOrder ? (
        <AdminOrderDossier
          order={openOrder}
          busy={busyId === openOrder.id}
          bulkBusy={bulkBusy}
          confirming={confirmAdvance}
          trackingDraft={trackingDraft}
          carrierDraft={carrierDraft}
          err={err}
          msg={msg}
          waGeneric={orderWa(openOrder, 'generic')}
          waPaid={orderWa(openOrder, 'paid')}
          waShipped={orderWa(openOrder, 'shipped')}
          onTrackingDraft={setTrackingDraft}
          onCarrierDraft={setCarrierDraft}
          onClose={closeDossier}
          onAskAdvance={() => askAdvance(openOrder)}
          onConfirmAdvance={() => void confirmAdvanceNow()}
          onCancelAdvance={() => setConfirmAdvance(false)}
          refundingPaymentId={refundPaymentId}
          onAskRefund={(paymentId) => askRefund(paymentId)}
          onConfirmRefund={(paymentId) => void confirmRefundNow(paymentId)}
          onCancelRefund={() => setRefundPaymentId(null)}
          onResend={() => void resendStorePaidNotify(openOrder)}
          onCopyPublicId={() => void copyOrderField('publicId', openOrder.publicId)}
          onCopyTracking={() => void copyOrderField('tracking', openOrder.trackingCode || '')}
          onOpenCustomer={
            openOrder.user?.id ? () => void openCustomer(openOrder.user!.id) : undefined
          }
        />
      ) : null}
      </section>
      </div>
    </>
  );
}
