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

export function AdminMarketplaceSection() {
  const {
    products,
    form,
    sellers,
    commissions,
    commissionStatusFilter,
    setCommissionStatusFilter,
    commissionSellerFilter,
    setCommissionSellerFilter,
    commissionBusyId,
    payoutDraft,
    setPayoutDraft,
    ownerDraft,
    setOwnerDraft,
    ownerBusyId,
    sellerForm,
    setSellerForm,
    savingSeller,
    sellerBusyId,
    saveSeller,
    setSellerStatus,
    setSellerOwner,
    approveCommission,
    markCommissionPaid,
    exportCommissionsCsv,
  } = useAdminConsole();
  return (
    <>
      <div className="admin-section-panel">
      <p className="admin-section-intro">
        Fundação multi-seller. Checkout único continua igual. Repasse v1: ledger + PIX manual
        (sem split MP) — ver docs/MARKETPLACE.md. Produtos existentes ficam na Lojas Schimitz.
      </p>
      <section className="admin-card-pro">
        <div className="body">
          <h2>Novo vendedor</h2>
          <form className="form admin-form-pro" style={{ marginTop: 12, marginBottom: 0 }} onSubmit={saveSeller}>
            <label>
              Nome *
              <input
                value={sellerForm.name}
                onChange={(e) => setSellerForm({ ...sellerForm, name: e.target.value })}
                placeholder="Ex.: Parceiro Centro"
                required
              />
            </label>
            <label>
              Slug (opcional)
              <input
                value={sellerForm.slug}
                onChange={(e) => setSellerForm({ ...sellerForm, slug: e.target.value })}
                placeholder="parceiro-centro"
              />
            </label>
            <label>
              Status inicial
              <select
                value={sellerForm.status}
                onChange={(e) =>
                  setSellerForm({
                    ...sellerForm,
                    status: e.target.value as 'pending' | 'active' | 'suspended',
                  })
                }
              >
                <option value="pending">Pendente</option>
                <option value="active">Ativo</option>
                <option value="suspended">Suspenso</option>
              </select>
            </label>
            <button className="btn admin-btn-primary-accent" type="submit" disabled={savingSeller}>
              {savingSeller ? 'Salvando...' : 'Criar vendedor'}
            </button>
          </form>
        </div>
      </section>
      <h3 className="admin-section-heading">Vendedores ({sellers.length})</h3>
      <div className="admin-dense-list">
            {sellers.map((s) => (
              <div key={s.id} className={`admin-dense-row${s.status === 'suspended' ? ' admin-dense-row--muted' : ''}`}>
                <div className="admin-dense-row__main">
                    <div className="admin-dense-row__title">
                    <b>{s.name}</b>
                    <AdminStatusChip label={sellerStatusLabel(s.status)} tone={sellerStatusTone(s.status)} />
                    </div>
                    <div className="admin-dense-row__meta">
                      /{s.slug}
                      {s._count?.products != null ? ` · ${s._count.products} produto(s)` : ''}
                      {s.owner?.email ? ` · dono ${s.owner.email}` : ' · sem dono'}
                    </div>
                  <div className="admin-toolbar__row" style={{ marginTop: 10 }}>
                  <label className="admin-owner-field">
                    E-mail do dono (portal /vendedor)
                    <input
                      type="email"
                      value={ownerDraft[s.id] ?? s.owner?.email ?? ''}
                      onChange={(e) => setOwnerDraft((d) => ({ ...d, [s.id]: e.target.value }))}
                      placeholder="vendedor@email.com"
                    />
                  </label>
                  <button
                    type="button"
                    className="btn admin-btn-primary-accent"
                    disabled={ownerBusyId === s.id}
                    onClick={() => void setSellerOwner(s)}
                  >
                    {ownerBusyId === s.id ? '...' : 'Vincular dono'}
                  </button>
                  </div>
                </div>
                  <div className="admin-dense-row__actions">
                    {s.status !== 'active' ? (
                      <button
                        type="button"
                        className="btn admin-btn-primary-accent"
                        disabled={sellerBusyId === s.id}
                        onClick={() => void setSellerStatus(s, 'active')}
                      >
                        Ativar
                      </button>
                    ) : null}
                    {s.status !== 'suspended' ? (
                      <button
                        type="button"
                        className="btn ghost admin-btn-ghost-pro"
                        disabled={sellerBusyId === s.id}
                        onClick={() => void setSellerStatus(s, 'suspended')}
                      >
                        Suspender
                      </button>
                    ) : null}
                  </div>
              </div>
            ))}
            {!sellers.length ? (
              <p className="admin-empty">Nenhum vendedor ainda (rode a migration SCH-008).</p>
            ) : null}
      </div>

      <section className="admin-card-pro" style={{ marginTop: 16 }}>
        <div className="body">
          <h2>Comissões / Repasse (v1)</h2>
          <p className="admin-section-intro" style={{ marginTop: 8, marginBottom: 12 }}>
            Ledger no pagamento aprovado. Transferência real ainda é <b>PIX manual</b> (use a
            referência E2E ao marcar pago). Sem split Mercado Pago — ver docs/MARKETPLACE.md.
          </p>
          <div className="admin-toolbar" style={{ marginBottom: 12 }}>
          <div className="admin-toolbar__row">
            <label className="admin-date-field" style={{ minWidth: 140 }}>
              Status
              <select
                className="admin-filter-select"
                value={commissionStatusFilter}
                onChange={(e) =>
                  setCommissionStatusFilter(e.target.value as 'pending' | 'approved' | 'paid' | 'all')
                }
              >
                <option value="pending">Pendente</option>
                <option value="approved">Aprovada</option>
                <option value="paid">Paga</option>
                <option value="all">Todas</option>
              </select>
            </label>
            <label className="admin-date-field" style={{ minWidth: 200, flex: 1 }}>
              Vendedor
              <select
                className="admin-filter-select"
                value={commissionSellerFilter}
                onChange={(e) => setCommissionSellerFilter(e.target.value)}
              >
                <option value="">Todos</option>
                {sellers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn ghost admin-btn-ghost-pro"
              disabled={!commissionSellerFilter}
              onClick={() => void exportCommissionsCsv()}
              title={!commissionSellerFilter ? 'Selecione um vendedor' : 'Exportar CSV'}
            >
              Exportar CSV
            </button>
          </div>
          </div>
          <div className="admin-dense-list">
            {commissions.map((c) => (
              <div key={c.id} className="admin-dense-row">
                <div className="admin-dense-row__main">
                    <div className="admin-dense-row__title">
                    <b>{c.seller.name}</b>
                    <AdminStatusChip
                      label={commissionStatusLabel(c.status)}
                      tone={commissionStatusTone(c.status)}
                    />
                    <AdminStatusChip label={brl(c.amount)} tone="accent" />
                    <AdminStatusChip label={`${c.percent}%`} tone="neutral" />
                    </div>
                    <div className="admin-dense-row__meta">
                      {c.order.publicId} · {c.orderItem.qty}× {c.orderItem.name}
                      {c.payoutReference ? ` · ref ${c.payoutReference}` : ''}
                    </div>
                {c.status === 'pending' || c.status === 'approved' ? (
                  <div className="admin-toolbar__row" style={{ marginTop: 10 }}>
                    <label className="admin-owner-field">
                      Ref. PIX / nota
                      <input
                        value={payoutDraft[c.id] ?? ''}
                        onChange={(e) =>
                          setPayoutDraft((d) => ({ ...d, [c.id]: e.target.value }))
                        }
                        placeholder="E2E id ou observação"
                      />
                    </label>
                    {c.status === 'pending' ? (
                      <button
                        type="button"
                        className="btn ghost admin-btn-ghost-pro"
                        disabled={commissionBusyId === c.id}
                        onClick={() => void approveCommission(c)}
                      >
                        {commissionBusyId === c.id ? '...' : 'Aprovar'}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn admin-btn-primary-accent"
                      disabled={commissionBusyId === c.id}
                      onClick={() => void markCommissionPaid(c)}
                    >
                      {commissionBusyId === c.id ? '...' : 'Marcar pago'}
                    </button>
                  </div>
                ) : null}
                </div>
              </div>
            ))}
            {!commissions.length ? (
              <p className="admin-empty">Nenhuma comissão neste filtro.</p>
            ) : null}
          </div>
        </div>
      </section>

      </div>
    </>
  );
}
