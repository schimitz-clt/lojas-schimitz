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

export function AdminFreteSection() {
  const {
    form,
    shippingSettings,
    shippingRules,
    shippingForm,
    setShippingForm,
    cepRuleForm,
    setCepRuleForm,
    savingShipping,
    savingCepRule,
    saveShippingSettings,
    saveCepRule,
    toggleCepRule,
    removeCepRule,
  } = useAdminConsole();
  return (
    <>
      <div className="admin-section-panel">
      <p className="admin-section-intro">
            Sem Melhor Envio/Correios. Defina frete grátis, taxa padrão e zonas por prefixo de CEP
            (ex.: 890 = região; 89010 = mais específico). O prefixo mais longo vence.
      </p>
      <section className="admin-card-pro">
        <div className="body">
          <h2>Configuração padrão</h2>
          <form className="form admin-form-pro" onSubmit={saveShippingSettings} style={{ marginTop: 12, marginBottom: 0 }}>
            <div className="row" style={{ alignItems: 'stretch' }}>
              <label style={{ flex: 1 }}>
                Frete grátis a partir de (R$) *
                <input
                  inputMode="decimal"
                  value={shippingForm.freeAbove}
                  onChange={(e) => setShippingForm({ ...shippingForm, freeAbove: e.target.value })}
                  placeholder="299"
                  required
                />
              </label>
              <label style={{ flex: 1 }}>
                Taxa padrão (R$) *
                <input
                  inputMode="decimal"
                  value={shippingForm.defaultFee}
                  onChange={(e) => setShippingForm({ ...shippingForm, defaultFee: e.target.value })}
                  placeholder="19,90"
                  required
                />
              </label>
              <label style={{ flex: 1 }}>
                Prazo padrão (dias) *
                <input
                  inputMode="numeric"
                  value={shippingForm.defaultDays}
                  onChange={(e) => setShippingForm({ ...shippingForm, defaultDays: e.target.value })}
                  placeholder="5"
                  required
                />
              </label>
            </div>
            <button className="btn admin-btn-primary-accent" type="submit" disabled={savingShipping}>
              {savingShipping ? 'Salvando...' : 'Salvar configuração de frete'}
            </button>
            {shippingSettings ? (
              <p className="admin-dense-row__meta" style={{ margin: 0 }}>
                Atual: grátis ≥ {brl(shippingSettings.freeAbove)} · padrão {brl(shippingSettings.defaultFee)} ·{' '}
                {shippingSettings.defaultDays} dias
              </p>
            ) : null}
          </form>
        </div>
      </section>

      <section className="admin-card-pro">
        <div className="body">
          <h2>Zonas por CEP</h2>
          <form className="form admin-form-pro" onSubmit={saveCepRule} style={{ marginTop: 12, marginBottom: 14 }}>
            <div className="row" style={{ alignItems: 'stretch' }}>
              <label style={{ flex: 1 }}>
                Prefixo CEP *
                <input
                  value={cepRuleForm.cepPrefix}
                  onChange={(e) => setCepRuleForm({ ...cepRuleForm, cepPrefix: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                  placeholder="Ex.: 890 ou 89010"
                  required
                />
              </label>
              <label style={{ flex: 1 }}>
                Taxa (R$) *
                <input
                  inputMode="decimal"
                  value={cepRuleForm.fee}
                  onChange={(e) => setCepRuleForm({ ...cepRuleForm, fee: e.target.value })}
                  placeholder="15,00"
                  required
                />
              </label>
              <label style={{ flex: 1 }}>
                Prazo (dias) *
                <input
                  inputMode="numeric"
                  value={cepRuleForm.estimatedDays}
                  onChange={(e) => setCepRuleForm({ ...cepRuleForm, estimatedDays: e.target.value })}
                  placeholder="3"
                  required
                />
              </label>
            </div>
            <label>
              Nome da zona (opcional)
              <input
                value={cepRuleForm.label}
                onChange={(e) => setCepRuleForm({ ...cepRuleForm, label: e.target.value })}
                placeholder="Ex.: Grande Florianópolis"
              />
            </label>
            <label className="admin-checkbox">
              <input
                type="checkbox"
                checked={cepRuleForm.active}
                onChange={(e) => setCepRuleForm({ ...cepRuleForm, active: e.target.checked })}
              />
              Zona ativa
            </label>
            <button className="btn admin-btn-primary-accent" type="submit" disabled={savingCepRule}>
              {savingCepRule ? 'Salvando...' : 'Adicionar zona'}
            </button>
          </form>
          <div className="admin-dense-list">
            {shippingRules.map((r) => (
              <div
                key={r.id}
                className={`admin-dense-row${r.active ? '' : ' admin-dense-row--muted'}`}
              >
                <div className="admin-dense-row__main">
                  <div className="admin-dense-row__title">
                    <b>CEP {r.cepPrefix}…</b>
                    <AdminStatusChip
                      label={shippingZoneActiveLabel(r.active)}
                      tone={r.active ? 'ok' : 'neutral'}
                    />
                  </div>
                  <div className="admin-dense-row__meta">
                    {brl(r.fee)} · {r.estimatedDays} dia{r.estimatedDays === 1 ? '' : 's'}
                    {r.label ? ` · ${r.label}` : ''}
                  </div>
                </div>
                <div className="admin-dense-row__actions">
                <button type="button" className="btn ghost admin-btn-ghost-pro" onClick={() => toggleCepRule(r)}>
                  {r.active ? 'Desativar' : 'Ativar'}
                </button>
                <button type="button" className="btn ghost admin-btn-ghost-pro" onClick={() => removeCepRule(r)}>
                  Remover
                </button>
                </div>
              </div>
            ))}
            {!shippingRules.length ? (
              <p className="admin-empty">Nenhuma zona ainda. Sem zonas, vale a taxa padrão para todos os CEPs.</p>
            ) : null}
          </div>
        </div>
      </section>

      </div>
    </>
  );
}
