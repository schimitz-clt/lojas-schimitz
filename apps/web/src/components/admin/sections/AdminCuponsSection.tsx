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

export function AdminCuponsSection() {
  const {
    form,
    coupons,
    couponForm,
    setCouponForm,
    savingCoupon,
    saveCoupon,
    toggleCoupon,
  } = useAdminConsole();
  return (
    <>
      <div className="admin-section-panel">
      <p className="admin-section-intro">
            Crie códigos de desconto (% ou valor fixo). O cliente aplica no checkout. Use cupons ativos
            para campanhas (ex.: BEMVINDO10) mesmo sem banner na home. Não crie cupom percentual que
            duplique o 5% automático do PIX (código PIX5 está aposentado/colidente).
      </p>
      {(() => {
        const couponStats = couponListStats(coupons);
        return (
          <div className="admin-stat-pills">
            <AdminStatusChip label={`${couponStats.active} ativo(s)`} tone="ok" />
            <AdminStatusChip label={`${couponStats.inactive} inativo(s)`} tone="neutral" />
            <AdminStatusChip label={`${couponStats.uses} uso(s) total`} tone="info" />
            <AdminStatusChip label={`${couponStats.reserved} reservado(s)`} tone="warn" />
          </div>
        );
      })()}
      <section className="admin-card-pro">
        <div className="body">
          <h2>Novo cupom</h2>
          <form className="form admin-form-pro" style={{ marginTop: 12, marginBottom: 0 }} onSubmit={saveCoupon}>
            <div className="row" style={{ alignItems: 'stretch' }}>
              <label style={{ flex: 1 }}>
                Código *
                <input
                  value={couponForm.code}
                  onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                  placeholder="EX.: BEMVINDO10"
                  required
                />
              </label>
              <label style={{ flex: 1 }}>
                Tipo *
                <select
                  value={couponForm.type}
                  onChange={(e) => setCouponForm({ ...couponForm, type: e.target.value as 'percent' | 'fixed' })}
                >
                  <option value="percent">Percentual (%)</option>
                  <option value="fixed">Valor fixo (R$)</option>
                </select>
              </label>
            </div>
            <div className="row" style={{ alignItems: 'stretch' }}>
              <label style={{ flex: 1 }}>
                {couponForm.type === 'percent' ? 'Percentual *' : 'Valor (R$) *'}
                <input
                  inputMode="decimal"
                  value={couponForm.value}
                  onChange={(e) => setCouponForm({ ...couponForm, value: e.target.value })}
                  placeholder={couponForm.type === 'percent' ? '10' : '50,00'}
                  required
                />
              </label>
              <label style={{ flex: 1 }}>
                Subtotal mínimo (opcional)
                <input
                  inputMode="decimal"
                  value={couponForm.minSubtotal}
                  onChange={(e) => setCouponForm({ ...couponForm, minSubtotal: e.target.value })}
                  placeholder="0"
                />
              </label>
            </div>
            <div className="row" style={{ alignItems: 'stretch' }}>
              <label style={{ flex: 1 }}>
                Validade (opcional)
                <input
                  type="date"
                  value={couponForm.endsAt}
                  onChange={(e) => setCouponForm({ ...couponForm, endsAt: e.target.value })}
                />
              </label>
              <label style={{ flex: 1 }}>
                Limite de usos (opcional)
                <input
                  inputMode="numeric"
                  value={couponForm.maxUses}
                  onChange={(e) => setCouponForm({ ...couponForm, maxUses: e.target.value })}
                  placeholder="Ilimitado"
                />
              </label>
            </div>
            <label className="admin-checkbox">
              <input
                type="checkbox"
                checked={couponForm.active}
                onChange={(e) => setCouponForm({ ...couponForm, active: e.target.checked })}
              />
              Cupom ativo
            </label>
            <button className="btn admin-btn-primary-accent" type="submit" disabled={savingCoupon}>
              {savingCoupon ? 'Salvando...' : 'Criar cupom'}
            </button>
          </form>
        </div>
      </section>
      <h3 className="admin-section-heading">Cupons ({coupons.length})</h3>
          <div className="admin-dense-list">
            {coupons.map((c) => {
              const expired = couponIsExpired(c.endsAt);
              const exhausted = couponIsExhausted(c.maxUses, c.usedCount);
              return (
              <div
                key={c.id}
                className={`admin-dense-row${c.active ? ' admin-dense-row--accent' : ' admin-dense-row--muted'}`}
              >
                <div className="admin-dense-row__main">
                  <div className="admin-dense-row__title">
                    <span className="admin-dense-row__code">{c.code}</span>
                    <AdminStatusChip
                      label={c.type === 'percent' ? `${c.value}%` : brl(c.value)}
                      tone="accent"
                    />
                    <AdminStatusChip
                      label={c.active ? 'Ativo' : 'Inativo'}
                      tone={c.active ? 'ok' : 'neutral'}
                    />
                    {expired ? <AdminStatusChip label="Expirado" tone="danger" /> : null}
                    {exhausted ? <AdminStatusChip label="Esgotado" tone="warn" /> : null}
                  </div>
                  <div className="admin-dense-row__meta">
                    {c.minSubtotal != null ? `Mín. ${brl(c.minSubtotal)} · ` : ''}
                    {c.endsAt ? `válido até ${new Date(c.endsAt).toLocaleDateString('pt-BR')} · ` : 'sem validade · '}
                    usos {c.usedCount}{c.maxUses != null ? `/${c.maxUses}` : ''}
                    {c.reservedCount ? ` · ${c.reservedCount} em pedidos abertos` : ''}
                  </div>
                </div>
                <div className="admin-dense-row__actions">
                <button type="button" className="btn ghost admin-btn-ghost-pro" onClick={() => toggleCoupon(c)}>
                  {c.active ? 'Desativar' : 'Ativar'}
                </button>
                </div>
              </div>
              );
            })}
            {!coupons.length ? (
              <p className="admin-empty">
                Nenhum cupom ainda. Crie o primeiro acima — ele aparece no checkout mesmo sem banner.
              </p>
            ) : null}
          </div>

      </div>
    </>
  );
}
