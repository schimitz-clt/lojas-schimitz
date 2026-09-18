'use client';

import { useState } from 'react';
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

export function AdminCatalogoSection() {
  const {
    products,
    categories,
    saving,
    uploading,
    uploadProgress,
    err,
    msg,
    editingId,
    form,
    setForm,
    formImages,
    setFormImages,
    lowStockThreshold,
    setLowStockThreshold,
    sellers,
    ops,
    catalogPhotoFilter,
    setCatalogPhotoFilter,
    listPhotoBusyId,
    downloadProductsNeedingPhotosCsv,
    editingLabel,
    lowStockProducts,
    photoQueueCount,
    visibleCatalogProducts,
    startEdit,
    resetForm,
    uploadPhotos,
    removeFormImage,
    moveFormImage,
    setCoverImage,
    saveProduct,
    uploadListPhotos,
    addPhotoFromUrl,
  } = useAdminConsole();
  const [photoUrlDraft, setPhotoUrlDraft] = useState('');
  const canAddPhotos = formImages.length < MAX_PRODUCT_IMAGES;
  return (
    <>
      <div className="admin-section-panel admin-catalog">
      <section id="admin-product-form" className="admin-card-pro admin-catalog-form" style={{ marginTop: 0, marginBottom: 0 }}>
        <div className="body">
          <div className="row" style={{ marginBottom: 12 }}>
            <h2>{editingLabel}</h2>
            {editingId ? (
              <button type="button" className="btn ghost" onClick={resetForm}>
                Cancelar edição
              </button>
            ) : null}
          </div>
          <form className="form admin-form-pro" style={{ maxWidth: 560 }} onSubmit={saveProduct}>
            <label>
              Nome do produto *
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder='Ex.: Smart TV 55" 4K'
                required
              />
            </label>
            <label>
              Descrição
              <textarea
                rows={10}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="O que o cliente precisa saber — modelo, especificações, garantia"
              />
              <span className="muted" style={{ fontSize: 12 }}>
                {form.description.trim().length} caracteres · aparece inteira na página do produto
              </span>
            </label>
            <div className="row" style={{ alignItems: 'stretch' }}>
              <label style={{ flex: 1 }}>
                Preço (R$) *
                <input
                  inputMode="decimal"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="199,90"
                  required
                />
              </label>
              <label style={{ flex: 1 }}>
                Preço “de” (opcional)
                <input
                  inputMode="decimal"
                  value={form.compareAtPrice}
                  onChange={(e) => setForm({ ...form, compareAtPrice: e.target.value })}
                  placeholder="249,90"
                />
              </label>
            </div>
            <div className="row" style={{ alignItems: 'stretch' }}>
              <label style={{ flex: 1 }}>
                Estoque *
                <input
                  inputMode="numeric"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  required
                />
              </label>
              <label style={{ flex: 1 }}>
                Código SKU
                <input
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  placeholder="Deixe em branco para gerar"
                />
              </label>
            </div>
            <label>
              Categoria
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              >
                <option value="">Sem categoria</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Vendedor (marketplace)
              <select
                value={form.sellerId}
                onChange={(e) => setForm({ ...form, sellerId: e.target.value })}
              >
                <option value="">Lojas Schimitz (padrão)</option>
                {sellers.map((s) => (
                  <option key={s.id} value={s.id} disabled={s.status === 'suspended'}>
                    {s.name} ({s.status})
                  </option>
                ))}
              </select>
            </label>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>
                Fotos do produto{' '}
                <span className="muted" style={{ fontWeight: 500 }}>
                  ({formImages.length}/{MAX_PRODUCT_IMAGES})
                </span>
              </div>
              <p className="muted" style={{ margin: '0 0 10px', fontSize: 13 }}>
                Até {MAX_PRODUCT_IMAGES} fotos · JPG/PNG/WebP · 15 MB cada. A primeira é a capa da
                vitrine. Envie várias de uma vez ou vá adicionando — no produto já salvo, cada upload
                aplica na hora (não apaga as outras). No celular: toque em Escolher arquivos, selecione
                as fotos e confirme.
              </p>
              {err ? (
                <p role="alert" className="alert admin-photo-feedback admin-catalog-alert--danger">
                  {err}
                </p>
              ) : null}
              {uploadProgress ? (
                <p role="status" className="ok admin-photo-feedback">
                  {uploadProgress}
                </p>
              ) : null}
              {msg && !err && !uploadProgress ? (
                <p role="status" className="ok admin-photo-feedback">
                  {msg}
                </p>
              ) : null}
              <div className="row" style={{ alignItems: 'stretch', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                <AdminPhotoFilePicker
                  label={
                    uploading
                      ? uploadProgress || 'Enviando…'
                      : formImages.length
                        ? `Adicionar mais fotos (${formImages.length}/${MAX_PRODUCT_IMAGES})`
                        : 'Enviar fotos'
                  }
                  disabled={uploading || saving || !canAddPhotos}
                  onFiles={(files) => {
                    void uploadPhotos(files);
                  }}
                />
              </div>
              <div className="row" style={{ alignItems: 'flex-end', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <label style={{ flex: '1 1 220px', margin: 0 }}>
                  Ou cole a URL de uma foto
                  <input
                    value={photoUrlDraft}
                    onChange={(e) => setPhotoUrlDraft(e.target.value)}
                    placeholder="https://...jpg"
                    disabled={!canAddPhotos || uploading || saving}
                  />
                </label>
                <button
                  type="button"
                  className="btn ghost"
                  disabled={!canAddPhotos || uploading || saving || !photoUrlDraft.trim()}
                  onClick={() => {
                    const url = photoUrlDraft;
                    void addPhotoFromUrl(url).then((ok) => {
                      if (ok) setPhotoUrlDraft('');
                    });
                  }}
                >
                  Adicionar URL
                </button>
              </div>
              {formImages.length ? (
                <div className="admin-photo-grid">
                  {formImages.map((img, i) => (
                    <div
                      key={img.id || `${img.url}-${i}`}
                      className={`admin-photo-tile${i === 0 ? ' admin-photo-tile--cover' : ''}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={`Foto ${i + 1}`}
                        style={{
                          width: '100%',
                          aspectRatio: '1',
                          objectFit: 'cover',
                          borderRadius: 8,
                          background: '#000',
                          display: 'block',
                        }}
                      />
                      <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                        {i === 0 ? 'Capa' : `Foto ${i + 1}`}
                      </div>
                      <div className="row" style={{ gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                        <button
                          type="button"
                          className="btn ghost"
                          style={{ padding: '4px 8px', fontSize: 12, margin: 0 }}
                          disabled={i === 0 || uploading || saving}
                          onClick={() => void setCoverImage(i)}
                        >
                          Capa
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          style={{ padding: '4px 8px', fontSize: 12, margin: 0 }}
                          disabled={i === 0 || uploading || saving}
                          onClick={() => void moveFormImage(i, -1)}
                          aria-label="Mover para esquerda"
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          style={{ padding: '4px 8px', fontSize: 12, margin: 0 }}
                          disabled={i >= formImages.length - 1 || uploading || saving}
                          onClick={() => void moveFormImage(i, 1)}
                          aria-label="Mover para direita"
                        >
                          →
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          style={{ padding: '4px 8px', fontSize: 12, margin: 0, color: '#ffb4b4' }}
                          disabled={uploading || saving}
                          onClick={() => {
                            if (confirm(`Remover foto ${i + 1}?`)) void removeFormImage(i);
                          }}
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p role="status" className="admin-catalog-alert">
                  Sem foto — a vitrine fica sem imagem. Envie JPG/PNG/WebP ou cole uma URL abaixo
                  (capa).
                </p>
              )}
              {formImages.some((img) => isPlaceholderImageUrl(img.url)) ? (
                <p role="status" className="admin-catalog-alert" style={{ marginTop: 10 }}>
                  Há imagem placeholder (placehold.co) — troque por foto real antes de vender.
                </p>
              ) : null}
            </div>
            {!editingId ? (
              <label>
                URL da capa (opcional, se não enviar arquivo)
                <input
                  value={form.imageUrl}
                  onChange={(e) => {
                    const url = e.target.value;
                    setForm({ ...form, imageUrl: url });
                    setFormImages((prev) => {
                      const trimmed = url.trim();
                      if (!trimmed) {
                        return prev.filter((_, i) => i !== 0).map((img, i) => ({ ...img, position: i }));
                      }
                      if (!prev.length) return [{ url: trimmed, position: 0 }];
                      const next = [...prev];
                      next[0] = { ...next[0], url: trimmed };
                      return next;
                    });
                  }}
                  placeholder="https://... ou use Enviar fotos"
                />
              </label>
            ) : null}
            <label>
              Selo / destaque (opcional)
              <input
                value={form.badge}
                onChange={(e) => setForm({ ...form, badge: e.target.value })}
                placeholder="Ex.: Oferta, Mais vendido"
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: 'row' }}>
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Produto ativo (aparece na loja)
            </label>
            <button className="btn admin-btn-primary-accent" type="submit" disabled={saving}>
              {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Cadastrar produto'}
            </button>
          </form>
        </div>
      </section>

      
      </div>
      <div className="admin-section-panel admin-catalog">
<section className={`admin-card-pro admin-catalog-panel${lowStockProducts.length ? ' admin-catalog-panel--low' : ''}`} style={{ marginBottom: 0, borderColor: lowStockProducts.length ? 'var(--admin-danger)' : undefined }}>
        <div className="body">
          <div className="row" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <h2>
              Estoque baixo{' '}
              <AdminStatusChip
                label={String(lowStockProducts.length)}
                tone={lowStockProducts.length ? 'danger' : 'ok'}
              />
            </h2>
            <label style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, margin: 0, color: 'var(--admin-text)', fontSize: 13 }}>
              Limite ≤
              <input
                type="number"
                min={0}
                value={lowStockThreshold}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10);
                  setLowStockThreshold(Number.isNaN(n) || n < 0 ? DEFAULT_LOW_STOCK : n);
                }}
                style={{ width: 72, minHeight: 36 }}
              />
            </label>
          </div>
          <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
            Produtos com estoque em mãos igual ou abaixo do limite. Clique em Editar para repor.
          </p>
          {lowStockProducts.length ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {lowStockProducts.map((p) => (
                <div key={p.id} className="admin-low-stock-row">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <b>{p.name}</b>
                    <div className="muted">
                      Estoque: {p.inventory?.qtyOnHand ?? 0}
                      {(p.inventory?.qtyReserved ?? 0) > 0
                        ? ` · ${availableStock(p)} disponível`
                        : null}
                      {!p.active ? ' · Inativo' : ''}
                    </div>
                  </div>
                  <button type="button" className="btn ghost admin-btn-ghost-pro" onClick={() => startEdit(p)}>
                    Editar
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted" style={{ marginBottom: 0 }}>
              Nenhum produto abaixo do limite. Bom trabalho!
            </p>
          )}
        </div>
      </section>

      <h3 id="admin-photo-queue" className="admin-section-heading">
        Produtos (
        {catalogPhotoFilter === 'needs_photo'
          ? `${visibleCatalogProducts.length} / ${products.length}`
          : products.length}
        )
      </h3>
      <div className="admin-catalog-toolbar">
        <button
          type="button"
          className={`admin-filter-chip${catalogPhotoFilter === 'all' ? ' is-active' : ''}`}
          onClick={() => setCatalogPhotoFilter('all')}
        >
          Todos ({products.length})
        </button>
        <button
          type="button"
          className={`admin-filter-chip${catalogPhotoFilter === 'needs_photo' ? ' is-active' : ''}`}
          onClick={() => setCatalogPhotoFilter('needs_photo')}
        >
          Sem foto / placeholder ({photoQueueCount})
        </button>
        {ops?.catalog?.placeholderProductCount != null ? (
          <AdminStatusChip
            label={`Ops: ${ops.catalog.placeholderProductCount}`}
            tone={photoQueueCount > 0 ? 'warn' : 'ok'}
            title="Contagem do snapshot GET /admin/ops — Foto p/ trocar"
          />
        ) : null}
        <button
          type="button"
          className="btn ghost admin-btn-ghost-pro"
          onClick={() => void downloadProductsNeedingPhotosCsv()}
        >
          Baixar CSV
        </button>
      </div>
      {photoQueueCount ? (
        <p role="status" className="admin-catalog-alert">
          {photoQueueAlignmentNote(ops?.catalog?.placeholderProductCount, photoQueueCount)}
        </p>
      ) : catalogPhotoFilter === 'needs_photo' ? (
        <p role="status" className="admin-catalog-alert" style={{ background: 'var(--admin-ok-soft)', borderColor: '#86efac', color: 'var(--admin-ok)' }}>
          {emptyPhotoQueueMessage('needs_photo')}
        </p>
      ) : null}
      <div className="admin-product-list" style={{ marginBottom: 8 }}>
        {visibleCatalogProducts.map((p) => {
          const avail = availableStock(p);
          const onHand = p.inventory?.qtyOnHand ?? 0;
          const isLow = onHand <= lowStockThreshold;
          const imgUrl = rewritePublicUploadUrl(p.images?.[0]?.url) || p.images?.[0]?.url;
          const isPlaceholderImg = productNeedsStorePhoto(imgUrl);
          const photoKind = productPhotoBadgeKind({
            hasUrl: Boolean(imgUrl && String(imgUrl).trim()),
            isPlaceholderOrMissing: isPlaceholderImg,
          });
          const photoLabel = productPhotoBadgeLabel(photoKind);
          const imgCount = p.images?.length ?? (imgUrl ? 1 : 0);
          const canAddListPhotos = imgCount < MAX_PRODUCT_IMAGES;
          const listBusy = listPhotoBusyId === p.id;
          return (
            <div
              key={p.id}
              className={`admin-product-row${isLow ? ' admin-product-row--low' : ''}${isPlaceholderImg ? ' admin-product-row--needs-photo' : ''}`}
            >
              {imgUrl && !isPlaceholderImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imgUrl} alt="" className="admin-product-row__thumb" />
              ) : (
                <div className="admin-product-row__ph" aria-hidden>
                  {photoLabel || 'Sem foto'}
                </div>
              )}
              <div className="admin-product-row__main">
                <div className="admin-product-row__title">
                  <b>{p.name}</b>
                  <AdminProductActiveChip active={Boolean(p.active)} />
                  {photoLabel ? (
                    <AdminStatusChip label={photoLabel} tone="warn" />
                  ) : null}
                  {isLow ? (
                    <AdminProductStockChip
                      onHand={onHand}
                      threshold={lowStockThreshold}
                      active={Boolean(p.active)}
                      label="Estoque baixo"
                    />
                  ) : null}
                </div>
                <div className="admin-product-row__meta">
                  {p.sku} · {brl(p.price)}
                  {p.category ? ` · ${p.category.name}` : ''}
                  {` · ${imgCount} foto${imgCount === 1 ? '' : 's'}`}
                </div>
                <div className="admin-product-row__meta" style={{ color: isLow ? 'var(--admin-danger)' : undefined }}>
                  Estoque: {onHand}
                  {(p.inventory?.qtyReserved ?? 0) > 0
                    ? ` (${avail} disponível, ${p.inventory?.qtyReserved} reservado)`
                    : null}
                </div>
              </div>
              <div className="admin-product-row__actions">
                {canAddListPhotos ? (
                  <AdminPhotoFilePicker
                    variant="inline"
                    accent={isPlaceholderImg}
                    label={
                      listBusy
                        ? uploadProgress || 'Enviando…'
                        : isPlaceholderImg
                          ? 'Enviar foto'
                          : 'Adicionar fotos'
                    }
                    disabled={listBusy || uploading}
                    onFiles={(files) => {
                      void uploadListPhotos(p.id, files);
                    }}
                  />
                ) : null}
                <button
                  type="button"
                  className="btn ghost admin-btn-ghost-pro"
                  onClick={() => startEdit(p)}
                >
                  {isPlaceholderImg ? 'Editar / galeria' : 'Editar'}
                </button>
                {p.active ? (
                  <Link className="btn ghost admin-btn-ghost-pro" href={`/produto/${p.slug}`} target="_blank">
                    Ver na loja
                  </Link>
                ) : null}
              </div>
            </div>
          );
        })}
        {!visibleCatalogProducts.length ? (
          <p className="muted">{emptyPhotoQueueMessage(catalogPhotoFilter)}</p>
        ) : null}
      </div>

      </div>
    </>
  );
}
