'use client';

import Link from 'next/link';
import { brl } from '@/lib/api';
import {
  orderStatusLabel,
  adminQueueBucketLabel,
  POST_PAYMENT_OPS_HINT,
  isPostPaidStatus,
  ADMIN_ORDER_QUEUE_BUCKETS,
} from '@/lib/order-status';
import { isPlaceholderImageUrl } from '@/lib/placeholder-image';
import { rewritePublicUploadUrl } from '@/lib/public-upload-url';
import { shouldServerOrderSearch } from '@/lib/admin-order-search';
import {
  emptyOrdersQueueMessage,
  opsAlertCtaHintPt,
  opsAlertSeverityLabelPt,
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
  PAID_STUCK_HOURS_UI,
  availableStock,
  customerHint,
  formatStuckHours,
  isPaidStuckOrder,
  hoursSincePaid,
  advanceButtonLabel,
  orderWa,
} from '@/components/admin/admin-console-model';

export function AdminOpsSection() {
  const {
    orders,
    orderStatusFilter,
    ops,
    opsBusy,
    reconciliations,
    reconBusy,
    loadOps,
    selectOpsBucket,
    loadReconciliations,
    openCatalogPhotoQueue,
    selectOpsAlert,
    downloadProductsNeedingPhotosCsv,
    attentionAlerts,
    startEditById,
  } = useAdminConsole();
  return (
    <>
      <div className="admin-section-panel">
      <AdminAttentionStrip
        items={attentionAlerts.map((a) => ({
          code: a.code,
          severity: a.severity,
          message: a.message,
          recommendedAction: a.recommendedAction,
          evidenceLine: a.evidence?.reason
            ? `Evidência: ${a.evidence.reason}${
                a.evidence.providerStatus ? ` · status ${a.evidence.providerStatus}` : ''
              }${
                a.evidence.externalReference
                  ? ` · ref ${a.evidence.externalReference}`
                  : ''
              }`
            : null,
          ctaHint: opsAlertCtaHintPt(a),
        }))}
        onSelect={(code) => {
          const a = attentionAlerts.find((x) => x.code === code);
          if (a) selectOpsAlert(a);
        }}
      />

      <section className="admin-ops" aria-label="Centro de comando">
        <div className="admin-ops__body">
          <div className="admin-ops__head">
            <h2 className="admin-ops__title">Centro de comando</h2>
            <button
              type="button"
              className="btn ghost admin-btn-accent"
              disabled={opsBusy}
              onClick={() => {
                void loadOps();
                void loadReconciliations();
              }}
            >
              {opsBusy ? 'Atualizando…' : 'Atualizar'}
            </button>
          </div>
          <p className="admin-ops__intro">
            Dados reais de GET /admin/ops e reconciliações. Sem métricas inventadas. Alertas = revisão humana.
          </p>

          <div className="admin-kpi-grid">
            <div className="admin-kpi admin-kpi--accent">
              <div className="admin-kpi__label">Receita hoje</div>
              <div className="admin-kpi__value">
                {ops?.sales?.today ? brl(ops.sales.today.revenue) : '—'}
              </div>
              <div className="admin-kpi__hint">
                {ops?.sales?.today ? `${ops.sales.today.orderCount} pedido(s) pagos` : 'aguardando snapshot'}
              </div>
            </div>
            <div className="admin-kpi">
              <div className="admin-kpi__label">Receita 30 dias</div>
              <div className="admin-kpi__value">
                {ops?.sales?.last30d ? brl(ops.sales.last30d.revenue) : '—'}
              </div>
              <div className="admin-kpi__hint">
                {ops?.sales?.last30d ? `${ops.sales.last30d.orderCount} pedido(s) pagos` : 'aguardando snapshot'}
              </div>
            </div>
            <div className={`admin-kpi${(ops?.inventory.lowStockCount ?? 0) > 0 ? ' admin-kpi--warn' : ' admin-kpi--accent'}`}>
              <div className="admin-kpi__label">Estoque baixo</div>
              <div className="admin-kpi__value">{ops?.inventory.lowStockCount ?? '—'}</div>
            </div>
            <div className={`admin-kpi${(ops?.inventory.outOfStockCount ?? 0) > 0 ? ' admin-kpi--danger' : ''}`}>
              <div className="admin-kpi__label">Zerados</div>
              <div className={`admin-kpi__value${(ops?.inventory.outOfStockCount ?? 0) > 0 ? ' admin-kpi__value--danger' : ''}`}>
                {ops?.inventory.outOfStockCount ?? '—'}
              </div>
            </div>
            <div className={`admin-kpi${(ops?.payments?.pendingCount ?? 0) > 0 ? ' admin-kpi--warn' : ' admin-kpi--accent'}`}>
              <div className="admin-kpi__label">Pag. pendentes</div>
              <div className="admin-kpi__value">{ops?.payments?.pendingCount ?? '—'}</div>
            </div>
            <button
              type="button"
              className={`admin-kpi${
                (ops?.paidAwaitingOrg?.stuckCount ?? 0) > 0
                  ? ' admin-kpi--danger'
                  : (ops?.orders?.buckets?.paid ?? 0) > 0
                    ? ' admin-kpi--warn'
                    : ' admin-kpi--accent'
              }`}
              onClick={() => selectOpsBucket('paid')}
            >
              <div className="admin-kpi__label">Pagos p/ organizar</div>
              <div
                className={`admin-kpi__value${
                  (ops?.paidAwaitingOrg?.stuckCount ?? 0) > 0 ? ' admin-kpi__value--danger' : ''
                }`}
              >
                {ops?.paidAwaitingOrg?.paidAwaitingCount ?? ops?.orders?.buckets?.paid ?? '—'}
              </div>
              <div className="admin-kpi__hint">
                {(ops?.paidAwaitingOrg?.stuckCount ?? 0) > 0
                  ? `${ops!.paidAwaitingOrg!.stuckCount} travado(s) ≥${ops?.paidAwaitingOrg?.stuckHoursThreshold ?? PAID_STUCK_HOURS_UI}h`
                  : `limite ${ops?.paidAwaitingOrg?.stuckHoursThreshold ?? PAID_STUCK_HOURS_UI}h`}
              </div>
            </button>
            <button
              type="button"
              className={`admin-kpi${(ops?.reconciliations?.openCount ?? 0) > 0 ? ' admin-kpi--danger' : ' admin-kpi--accent'}`}
              onClick={() => {
                const el = document.getElementById('admin-reconciliations');
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                void loadReconciliations();
              }}
            >
              <div className="admin-kpi__label">Reconciliações abertas</div>
              <div className={`admin-kpi__value${(ops?.reconciliations?.openCount ?? 0) > 0 ? ' admin-kpi__value--danger' : ''}`}>
                {ops?.reconciliations?.openCount ?? '—'}
              </div>
            </button>
            <button
              type="button"
              className={`admin-kpi${(ops?.catalog?.placeholderProductCount ?? 0) > 0 ? ' admin-kpi--warn' : ' admin-kpi--accent'}`}
              onClick={() => openCatalogPhotoQueue()}
            >
              <div className="admin-kpi__label">Foto p/ trocar</div>
              <div className="admin-kpi__value">{ops?.catalog?.placeholderProductCount ?? '—'}</div>
              <div className="admin-kpi__hint">fila Catálogo + CSV</div>
            </button>
            <div
              className={`admin-kpi${
                (ops?.mail?.storeNotifyFailureCount ?? 0) > 0 || ops?.mail?.providerOffWithStoreNotify
                  ? ' admin-kpi--danger'
                  : ops?.mail?.configured
                    ? ' admin-kpi--accent'
                    : ' admin-kpi--danger'
              }`}
            >
              <div className="admin-kpi__label">E-mail loja</div>
              <div
                className={`admin-kpi__value${
                  ops == null ||
                  ((ops.mail?.storeNotifyFailureCount ?? 0) === 0 && ops.mail?.configured)
                    ? ''
                    : ' admin-kpi__value--danger'
                }`}
                style={{ fontSize: 16 }}
              >
                {ops == null
                  ? '—'
                  : (ops.mail?.storeNotifyFailureCount ?? 0) > 0
                    ? `${ops.mail!.storeNotifyFailureCount} falha(s)`
                    : ops.mail?.providerOffWithStoreNotify
                      ? 'Provedor off'
                      : ops.mail?.configured
                        ? 'Configurado'
                        : 'Ausente'}
              </div>
              {ops?.mail?.lastStoreNotifyFailure?.publicId ? (
                <div className="admin-kpi__hint">
                  último: {ops.mail.lastStoreNotifyFailure.publicId}
                </div>
              ) : null}
            </div>
            <div className="admin-kpi">
              <div className="admin-kpi__label">Pedidos (total)</div>
              <div className="admin-kpi__value">{ops?.orders?.total ?? '—'}</div>
            </div>
          </div>

          {ops?.alerts?.length ? (
            <div style={{ marginBottom: 14 }}>
              <p className="muted" style={{ margin: '0 0 8px', fontSize: 13, color: '#f5e6a3' }}>
                Alertas (condições reais do snapshot)
              </p>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
                {ops.alerts.map((a) => {
                  const clickable = Boolean(a.queueBucket || a.section);
                  const tone =
                    a.severity === 'critical' || a.severity === 'high'
                      ? 'high'
                      : a.severity === 'warn'
                        ? 'warn'
                        : 'info';
                  return (
                    <li key={a.code}>
                      <button
                        type="button"
                        className={`admin-alert-btn admin-alert-btn--${tone}`}
                        onClick={() => selectOpsAlert(a)}
                        disabled={!clickable}
                        style={{
                          opacity: clickable ? 1 : 0.95,
                          cursor: clickable ? 'pointer' : 'default',
                        }}
                      >
                        <span style={{ fontSize: 11, textTransform: 'uppercase', marginRight: 8, opacity: 0.85 }}>
                          {opsAlertSeverityLabelPt(a.severity)}
                        </span>
                        {a.message}
                        {opsAlertCtaHintPt(a) ? ` ${opsAlertCtaHintPt(a)}` : ''}
                        {a.recommendedAction ? (
                          <span style={{ display: 'block', fontSize: 11, opacity: 0.8, marginTop: 4 }}>
                            {a.recommendedAction}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : ops ? (
            <p className="muted" style={{ marginTop: 0, marginBottom: 14, fontSize: 13, color: '#8a8a84' }}>
              Sem alertas no momento.
            </p>
          ) : null}

          <div style={{ marginTop: 4 }}>
            <p className="muted" style={{ margin: '0 0 8px', fontSize: 13, color: '#f5e6a3' }}>
              Fila operacional — clique no bucket para filtrar pedidos
            </p>
            <div className="admin-chip-row">
              <button
                type="button"
                className={`admin-chip${orderStatusFilter === '' ? ' is-active' : ''}`}
                onClick={() => selectOpsBucket('')}
              >
                Todos: {ops?.orders?.total ?? '—'}
              </button>
              {ADMIN_ORDER_QUEUE_BUCKETS.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`admin-chip${orderStatusFilter === key ? ' is-active' : ''}`}
                  onClick={() => selectOpsBucket(key)}
                >
                  {adminQueueBucketLabel(key)}: {ops?.orders?.buckets?.[key] ?? 0}
                </button>
              ))}
            </div>
          </div>

          {ops?.catalog?.placeholderProducts?.length ? (
            <div style={{ marginTop: 14 }} id="admin-photos-checklist">
              <div
                className="row"
                style={{ marginBottom: 8, flexWrap: 'wrap', gap: 8, alignItems: 'center' }}
              >
                <p className="muted" style={{ margin: 0, fontSize: 13, color: '#f5e6a3', flex: 1 }}>
                  Checklist — produtos que precisam de foto da loja (sem inventar imagem).
                  Motivo: sem foto ou host placeholder (placehold.co etc.).
                </p>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => openCatalogPhotoQueue()}
                  style={{ borderColor: '#ffd100', color: '#ffd100', minHeight: 36 }}
                >
                  Abrir fila no Catálogo
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => void downloadProductsNeedingPhotosCsv()}
                  style={{ borderColor: '#ffd100', color: '#ffd100', minHeight: 36 }}
                >
                  Baixar CSV
                </button>
              </div>
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', fontSize: 13, color: '#f5f5f3' }}>
                {ops.catalog.placeholderProducts.map((p) => {
                  const reason =
                    p.reason ||
                    (p.imageUrl && p.imageUrl.trim() ? 'placeholder' : 'missing');
                  return (
                    <li
                      key={p.id}
                      style={{
                        marginBottom: 8,
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 8,
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderRadius: 8,
                        background: '#1a1a1a',
                        border: '1px solid #3a3a32',
                      }}
                    >
                      <span style={{ minWidth: 0 }}>
                        <b style={{ color: '#fff' }}>{p.name}</b>{' '}
                        <span
                          className="badge"
                          style={{
                            background: reason === 'missing' ? '#3a1515' : '#3a2f0a',
                            color: reason === 'missing' ? '#ffb4b4' : '#ffd100',
                            fontSize: 11,
                          }}
                        >
                          {reason === 'missing' ? 'Sem foto' : 'Placeholder'}
                        </span>
                        <br />
                        <code style={{ color: '#ffd100', fontSize: 11 }}>{p.id}</code>
                        {p.imageUrl ? (
                          <span style={{ display: 'block', fontSize: 11, opacity: 0.75, wordBreak: 'break-all' }}>
                            URL atual: {p.imageUrl}
                          </span>
                        ) : (
                          <span style={{ display: 'block', fontSize: 11, opacity: 0.75 }}>
                            URL atual: (vazia)
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        className="btn"
                        style={{ background: '#ffd100', color: '#111', minHeight: 36 }}
                        onClick={() => startEditById(p.id)}
                      >
                        Trocar foto
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : ops ? (
            <p className="muted" style={{ marginTop: 14, fontSize: 13, color: '#8a8a84' }}>
              Checklist de fotos: nenhum produto com placeholder/ausente no snapshot.
            </p>
          ) : null}
          {ops?.time ? (
            <p className="muted" style={{ marginBottom: 0, marginTop: 10, fontSize: 12, color: '#8a8a84' }}>
              Snapshot: {ops.time}
            </p>
          ) : null}
        </div>
      </section>

      <section
        id="admin-reconciliations"
        className="admin-ops"
        style={{ marginTop: 16 }}
        aria-label="Reconciliações"
      >
        <div className="admin-ops__body">
          <div className="row" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <h2 className="admin-ops__title">Reconciliações</h2>
            <button
              type="button"
              className="btn ghost"
              disabled={reconBusy}
              onClick={() => void loadReconciliations()}
              style={{ borderColor: '#ffd100', color: '#ffd100' }}
            >
              {reconBusy ? 'Atualizando…' : 'Atualizar lista'}
            </button>
          </div>
          <p className="muted" style={{ marginTop: 0, fontSize: 14, color: '#b0b0a8' }}>
            Webhooks que não aplicaram o pagamento no pedido: órfãos (sem Payment local) e divergência de valor ou referência (`GET /admin/payments/reconciliations`).
            Somente revisão humana — sem estorno, cancelamento ou ajuste de estoque automático.
          </p>
          <p className="muted" style={{ fontSize: 13, color: '#f5e6a3', marginTop: 0 }}>
            Abertas no snapshot: {ops?.reconciliations?.openCount ?? '—'} · listadas: {reconciliations.length}
          </p>
          <div style={{ display: 'grid', gap: 8 }}>
            {(reconciliations.length
              ? reconciliations
              : (ops?.reconciliations?.recent || []).map((r) => ({
                  ...r,
                  provider: undefined,
                  externalId: undefined,
                  publicId: null,
                  amount: null,
                }))
            ).map((r) => (
              <div
                key={r.id}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: '#1a1a1a',
                  border: '1px solid #ffd100',
                  fontSize: 13,
                }}
              >
                <div className="row" style={{ flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <b style={{ color: '#ffd100' }}>{r.reason || 'reconciliação'}</b>{' '}
                    <span className="badge" style={{ background: '#3a1515', color: '#ffb4b4' }}>
                      {r.status}
                    </span>
                    <div className="muted" style={{ fontSize: 12, color: '#b0b0a8', marginTop: 4 }}>
                      providerStatus: {r.providerStatus || '—'}
                      {r.externalReference ? ` · ref ${r.externalReference}` : ''}
                      {'publicId' in r && r.publicId ? ` · publicId ${r.publicId}` : ''}
                      {'externalId' in r && r.externalId ? ` · ext ${r.externalId}` : ''}
                      {'amount' in r && r.amount != null ? ` · ${brl(Number(r.amount))}` : ''}
                      {'expectedPayment' in r && r.expectedPayment != null
                        ? ` · esperado ${brl(Number(r.expectedPayment))}`
                        : ''}
                      {'expectedOrder' in r &&
                      r.expectedOrder != null &&
                      r.expectedOrder !== r.expectedPayment
                        ? ` · total pedido ${brl(Number(r.expectedOrder))}`
                        : ''}
                    </div>
                    <div className="muted" style={{ fontSize: 11, color: '#8a8a84' }}>
                      id {r.id} · {r.createdAt ? new Date(r.createdAt).toLocaleString('pt-BR') : '—'}
                    </div>
                  </div>
                </div>
                <p style={{ margin: '8px 0 0', fontSize: 12, color: '#f5e6a3' }}>
                  Ação recomendada: conferir no provedor (ref/publicId) e decidir manualmente. Não executar
                  estorno/cancelamento daqui.
                </p>
              </div>
            ))}
            {!reconciliations.length && !(ops?.reconciliations?.recent?.length) ? (
              <p className="muted" style={{ margin: 0, fontSize: 13, color: '#8a8a84' }}>
                Nenhuma reconciliação aberta.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      </div>
    </>
  );
}
