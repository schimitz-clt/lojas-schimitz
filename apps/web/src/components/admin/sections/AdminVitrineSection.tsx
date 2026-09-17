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

export function AdminVitrineSection() {
  const {
    form,
    seoForm,
    setSeoForm,
    savingSeo,
    banners,
    bannerForm,
    setBannerForm,
    editingBannerId,
    savingBanner,
    uploadingBanner,
    bannerBusyId,
    saveSeo,
    uploadBannerPhoto,
    startEditBanner,
    resetBannerForm,
    saveBanner,
    toggleBannerActive,
    deleteBanner,
    moveBanner,
  } = useAdminConsole();
  return (
    <>
      <div className="admin-section-panel">
      <section className="admin-card-pro">
        <div className="body">
          <h2>SEO da loja</h2>
          <p className="admin-section-intro" style={{ marginTop: 8 }}>
            Título e descrição usados nas abas do navegador e no compartilhamento (Open Graph).
          </p>
          <form className="form admin-form-pro" onSubmit={saveSeo}>
            <label>
              Título do site *
              <input
                value={seoForm.siteTitle}
                onChange={(e) => setSeoForm({ ...seoForm, siteTitle: e.target.value })}
                maxLength={120}
                required
              />
            </label>
            <label>
              Descrição (meta) *
              <textarea
                value={seoForm.siteDescription}
                onChange={(e) => setSeoForm({ ...seoForm, siteDescription: e.target.value })}
                maxLength={320}
                required
              />
            </label>
            <label>
              Imagem Open Graph (URL opcional)
              <input
                value={seoForm.ogImageUrl}
                onChange={(e) => setSeoForm({ ...seoForm, ogImageUrl: e.target.value })}
                placeholder="https://... (ou use upload de banner e cole a URL)"
              />
            </label>
            <button className="btn admin-btn-primary-accent" type="submit" disabled={savingSeo}>
              {savingSeo ? 'Salvando...' : 'Salvar SEO'}
            </button>
          </form>
        </div>
      </section>

      <section className="admin-card-pro">
        <div className="body">
          <div className="row" style={{ marginBottom: 12 }}>
            <h2>
              {editingBannerId ? 'Editar banner' : 'Banners da home'}
            </h2>
            {editingBannerId ? (
              <button type="button" className="btn ghost admin-btn-ghost-pro" onClick={resetBannerForm}>
                Cancelar edição
              </button>
            ) : null}
          </div>
          <p className="admin-section-intro">
            Imagem + link opcional. Só banners ativos aparecem na vitrine (carrossel).
          </p>
          <form className="form admin-form-pro" style={{ marginBottom: 20 }} onSubmit={saveBanner}>
            <label>
              Título (opcional)
              <input
                value={bannerForm.title}
                onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })}
                placeholder="Ex.: Semana do eletro"
              />
            </label>
            <label>
              Texto alternativo (acessibilidade)
              <input
                value={bannerForm.alt}
                onChange={(e) => setBannerForm({ ...bannerForm, alt: e.target.value })}
                placeholder="Descreva a imagem"
              />
            </label>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Imagem do banner</div>
              <div className="row" style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <label className="btn ghost admin-btn-ghost-pro" style={{ cursor: uploadingBanner ? 'wait' : 'pointer', margin: 0 }}>
                  {uploadingBanner ? 'Enviando...' : 'Enviar imagem'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={uploadingBanner || savingBanner}
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      e.target.value = '';
                      void uploadBannerPhoto(f);
                    }}
                  />
                </label>
                {bannerForm.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={bannerForm.imageUrl}
                    alt="Prévia banner"
                    className="admin-banner-preview"
                  />
                ) : null}
              </div>
            </div>
            <label>
              URL da imagem *
              <input
                value={bannerForm.imageUrl}
                onChange={(e) => setBannerForm({ ...bannerForm, imageUrl: e.target.value })}
                placeholder="https://... ou envie acima"
                required
              />
            </label>
            <label>
              Link ao clicar (opcional)
              <input
                value={bannerForm.linkUrl}
                onChange={(e) => setBannerForm({ ...bannerForm, linkUrl: e.target.value })}
                placeholder="/departamento/ofertas ou https://..."
              />
            </label>
            <label className="admin-checkbox">
              <input
                type="checkbox"
                checked={bannerForm.active}
                onChange={(e) => setBannerForm({ ...bannerForm, active: e.target.checked })}
              />
              Banner ativo (aparece na home)
            </label>
            <button className="btn admin-btn-primary-accent" type="submit" disabled={savingBanner}>
              {savingBanner ? 'Salvando...' : editingBannerId ? 'Salvar banner' : 'Criar banner'}
            </button>
          </form>

          <div className="admin-dense-list">
            {banners.map((b, i) => (
              <div
                key={b.id}
                className={`admin-dense-row${b.active ? '' : ' admin-dense-row--muted'}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={b.imageUrl}
                  alt={b.alt || b.title || 'Banner'}
                  className="admin-banner-thumb"
                />
                <div className="admin-dense-row__main">
                  <div className="admin-dense-row__title">
                    <b>{b.title || '(sem título)'}</b>
                    <AdminStatusChip
                      label={bannerActiveLabel(b.active)}
                      tone={b.active ? 'ok' : 'neutral'}
                    />
                  </div>
                  <div className="admin-dense-row__meta">
                    ordem {i + 1}
                    {b.linkUrl ? ` · ${b.linkUrl}` : ''}
                  </div>
                </div>
                <div className="admin-dense-row__actions">
                  <button
                    type="button"
                    className="btn ghost admin-btn-ghost-pro"
                    disabled={bannerBusyId === b.id || i === 0}
                    onClick={() => void moveBanner(b, -1)}
                    title="Subir"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn ghost admin-btn-ghost-pro"
                    disabled={bannerBusyId === b.id || i === banners.length - 1}
                    onClick={() => void moveBanner(b, 1)}
                    title="Descer"
                  >
                    ↓
                  </button>
                  <button type="button" className="btn ghost admin-btn-ghost-pro" onClick={() => startEditBanner(b)}>
                    Editar
                  </button>
                  <button
                    type="button"
                    className="btn ghost admin-btn-ghost-pro"
                    disabled={bannerBusyId === b.id}
                    onClick={() => void toggleBannerActive(b)}
                  >
                    {b.active ? 'Desativar' : 'Ativar'}
                  </button>
                  <button
                    type="button"
                    className="btn ghost admin-btn-ghost-pro"
                    disabled={bannerBusyId === b.id}
                    onClick={() => void deleteBanner(b)}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
            {!banners.length ? (
              <p className="admin-empty">Nenhum banner ainda. Crie o primeiro acima.</p>
            ) : null}
          </div>
        </div>
      </section>

      </div>
    </>
  );
}
