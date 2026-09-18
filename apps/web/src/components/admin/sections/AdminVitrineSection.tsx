'use client';

import Link from 'next/link';
import { useEffect } from 'react';
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
import { AdminPhotoFilePicker } from '@/components/admin/AdminPhotoFilePicker';
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
import {
  ADMIN_BANNER_FORM_ID,
  ADMIN_BANNER_TITLE_ID,
  bannerCreateCtaLabel,
  canCreateHomeBanner,
  homeBannerCountHint,
  homeBannerRowCount,
  homeBannerSlotCounter,
  MAX_HOME_BANNERS,
} from '@/lib/home-banners';

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
    bannerErr,
    bannerMsg,
    bannerFormEpoch,
    saveSeo,
    uploadBannerPhoto,
    startEditBanner,
    resetBannerForm,
    beginNewBanner,
    saveBanner,
    toggleBannerActive,
    deleteBanner,
    moveBanner,
  } = useAdminConsole();
  const bannerTotal = homeBannerRowCount(banners);
  const canCreate = canCreateHomeBanner(bannerTotal);
  const showBannerForm = canCreate || Boolean(editingBannerId);

  useEffect(() => {
    if (!bannerFormEpoch) return;
    const form = document.getElementById(ADMIN_BANNER_FORM_ID);
    form?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const title = document.getElementById(ADMIN_BANNER_TITLE_ID) as HTMLInputElement | null;
    title?.focus();
  }, [bannerFormEpoch]);

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

      <section className="admin-card-pro" id="admin-vitrine-banners">
        <div className="body">
          <div className="row" style={{ marginBottom: 12, alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2>
              {editingBannerId ? 'Editar banner' : 'Banners da home'}
            </h2>
            <AdminStatusChip
              label={homeBannerSlotCounter(bannerTotal)}
              tone={canCreate ? 'info' : 'warn'}
            />
            {editingBannerId ? (
              <button type="button" className="btn ghost admin-btn-ghost-pro" onClick={resetBannerForm}>
                Cancelar edição
              </button>
            ) : null}
            {editingBannerId && canCreate ? (
              <button type="button" className="btn admin-btn-primary-accent" onClick={beginNewBanner}>
                Criar outro banner
              </button>
            ) : null}
          </div>
          <p className="admin-section-intro">
            {homeBannerCountHint(bannerTotal)} Imagem + link opcional. Só banners ativos
            entram no carrossel da home (swipe, um por vez). Limite conta ativos e inativos.
          </p>
          {bannerErr ? (
            <p role="alert" className="alert admin-photo-feedback admin-catalog-alert--danger">
              {bannerErr}
            </p>
          ) : null}
          {bannerMsg && !bannerErr ? (
            <p role="status" className="ok admin-photo-feedback">
              {bannerMsg}
            </p>
          ) : null}
          {showBannerForm ? (
          <form
            id={ADMIN_BANNER_FORM_ID}
            className="form admin-form-pro"
            style={{ marginBottom: 20 }}
            onSubmit={saveBanner}
          >
            <label>
              Título (opcional)
              <input
                id={ADMIN_BANNER_TITLE_ID}
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
              <p className="muted" style={{ margin: '0 0 10px', fontSize: 13 }}>
                JPG/PNG/WebP. No celular: toque em Enviar imagem ou no seletor visível, confirme,
                depois {editingBannerId ? 'Salvar banner' : bannerCreateCtaLabel(bannerTotal)}.
              </p>
              <div className="row" style={{ alignItems: 'stretch', gap: 10, flexWrap: 'wrap' }}>
                <AdminPhotoFilePicker
                  label={
                    uploadingBanner
                      ? 'Enviando...'
                      : bannerForm.imageUrl
                        ? 'Trocar imagem'
                        : 'Enviar imagem'
                  }
                  disabled={uploadingBanner || savingBanner}
                  multiple={false}
                  accent={!bannerForm.imageUrl}
                  inputId="admin-banner-file"
                  onFiles={(files) => {
                    void uploadBannerPhoto(files);
                  }}
                />
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
              {savingBanner
                ? 'Salvando...'
                : editingBannerId
                  ? 'Salvar banner'
                  : bannerCreateCtaLabel(bannerTotal)}
            </button>
          </form>
          ) : (
            <p className="admin-empty" style={{ marginBottom: 20 }}>
              Limite de {MAX_HOME_BANNERS} banners atingido. Edite ou exclua um para adicionar
              outro.
            </p>
          )}

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
