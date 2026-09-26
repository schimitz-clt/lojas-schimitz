'use client';

import { useEffect } from 'react';
import { textOrDash } from '@/lib/admin-enterprise-ui';
import {
  VITRINE_DO_LEDE,
  VITRINE_EVIDENCE_LEDE,
  VITRINE_NOW_LEDE,
  vitrinePrimeModel,
} from '@/lib/admin-prime-sections-ui';
import { AdminPrimeCommand, scrollAdminAnchor } from '@/components/admin/AdminPrimeCommand';
import { AdminStatusChip } from '@/components/admin/AdminStatusChip';
import { bannerActiveLabel } from '@/lib/admin-pro-ui';
import { useAdminConsole } from '@/components/admin/admin-console-context';
import { AdminPhotoFilePicker } from '@/components/admin/AdminPhotoFilePicker';
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

const ANCHOR: Record<string, string> = {
  banners_none_active: 'admin-vitrine-banners',
  banners_at_cap: 'admin-vitrine-banners',
  seo_og_missing: 'admin-vitrine-seo',
  uploads_ephemeral: 'admin-vitrine-banners',
  seo: 'admin-vitrine-seo',
  banners: 'admin-vitrine-banners',
  active: 'admin-vitrine-banners',
  inactive: 'admin-vitrine-banners',
  uploads: 'admin-vitrine-banners',
};

export function AdminVitrineSection() {
  const {
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
    storePayload,
    load,
    ops,
    opsSnapshot,
    loadOps,
  } = useAdminConsole();

  const uploadsAlert = (ops?.alerts || []).find((alert) => alert.code === 'uploads_ephemeral') || null;
  const model = vitrinePrimeModel({
    load: storePayload,
    banners: storePayload === 'ready' ? banners : null,
    seo: storePayload === 'ready' ? seoForm : null,
    opsReady: opsSnapshot === 'ready',
    uploads: ops?.uploads,
    uploadsAlert,
  });

  const bannerTotal = homeBannerRowCount(storePayload === 'ready' ? banners : null);
  const canCreate = storePayload === 'ready' && canCreateHomeBanner(bannerTotal);
  const showBannerForm = canCreate || Boolean(editingBannerId);

  useEffect(() => {
    if (!bannerFormEpoch) return;
    const form = document.getElementById(ADMIN_BANNER_FORM_ID);
    form?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const title = document.getElementById(ADMIN_BANNER_TITLE_ID) as HTMLInputElement | null;
    title?.focus();
  }, [bannerFormEpoch]);

  function go(id: string) {
    const anchor = ANCHOR[id];
    if (anchor) scrollAdminAnchor(anchor);
  }

  return (
    <>
      <AdminPrimeCommand
        eyebrow="Vitrine"
        title="Banners e SEO já gravados."
        endpoint="GET /admin/banners · GET /admin/store/settings · uploads em GET /admin/ops"
        busy={savingSeo || savingBanner || uploadingBanner}
        onRefresh={() => {
          void load();
          void loadOps();
        }}
        nowLede={VITRINE_NOW_LEDE}
        summary={model.summary}
        kpis={model.kpis}
        onKpi={go}
        load={storePayload}
        attention={model.attention}
        signals={model.signals}
        onAttention={go}
        doLede={VITRINE_DO_LEDE}
        actions={model.actions}
        onAction={go}
      />

      <div className="admin-section-panel">
        <p className="admin-ent-kicker">Evidência</p>
        <h2 className="admin-cc-block__title">O que a home mostra</h2>
        <p className="admin-cc-block__lede">{VITRINE_EVIDENCE_LEDE}</p>

        <section className="admin-card-pro" id="admin-vitrine-seo">
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
              <label>
                CNPJ (opcional — libera “Nota fiscal” na vitrine)
                <input
                  value={seoForm.cnpj}
                  onChange={(e) => setSeoForm({ ...seoForm, cnpj: e.target.value })}
                  inputMode="numeric"
                  placeholder="00.000.000/0000-00"
                />
              </label>
              <label>
                Fim da oferta do dia (opcional — sem data não há contagem)
                <input
                  type="datetime-local"
                  value={seoForm.promoEndsAt}
                  onChange={(e) => setSeoForm({ ...seoForm, promoEndsAt: e.target.value })}
                />
              </label>
              <label>
                Faixa do topo (uma frase por linha, opcional)
                <textarea
                  rows={3}
                  value={seoForm.promoLines}
                  onChange={(e) => setSeoForm({ ...seoForm, promoLines: e.target.value })}
                  placeholder="Vazio usa frete grátis em POA, PIX e parcelas reais"
                />
              </label>
              <label>
                Confiança (título | texto, opcional)
                <textarea
                  rows={3}
                  value={seoForm.trustItems}
                  onChange={(e) => setSeoForm({ ...seoForm, trustItems: e.target.value })}
                  placeholder="Vazio usa frete, compra segura e troca em 7 dias"
                />
              </label>
              <button className="btn admin-btn-primary-accent" type="submit" disabled={savingSeo}>
                {savingSeo ? 'Salvando...' : 'Salvar SEO'}
              </button>
              {storePayload === 'ready' ? (
                <p className="admin-ent-note">Título atual: {textOrDash(seoForm.siteTitle)}</p>
              ) : (
                <p className="admin-ent-note">— · SEO ainda não veio de GET /admin/store/settings.</p>
              )}
            </form>
          </div>
        </section>

        <section className="admin-card-pro" id="admin-vitrine-banners">
          <div className="body">
            <div className="row" style={{ marginBottom: 12, alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2>{editingBannerId ? 'Editar banner' : 'Banners da home'}</h2>
              <AdminStatusChip
                label={storePayload === 'ready' ? homeBannerSlotCounter(bannerTotal) : '—'}
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
              {storePayload === 'ready' ? homeBannerCountHint(bannerTotal) : 'A contagem aparece quando GET /admin/banners responder.'}{' '}
              Imagem + link opcional. Só banners ativos entram no carrossel da
              home (swipe, um por vez). Limite conta ativos e inativos.
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
              <form id={ADMIN_BANNER_FORM_ID} className="form admin-form-pro" style={{ marginBottom: 20 }} onSubmit={saveBanner}>
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
                    JPG/PNG/WebP. No celular: toque em Enviar imagem ou no seletor visível, confirme, depois{' '}
                    {editingBannerId ? 'Salvar banner' : bannerCreateCtaLabel(bannerTotal)}.
                  </p>
                  <div className="row" style={{ alignItems: 'stretch', gap: 10, flexWrap: 'wrap' }}>
                    <AdminPhotoFilePicker
                      label={uploadingBanner ? 'Enviando...' : bannerForm.imageUrl ? 'Trocar imagem' : 'Enviar imagem'}
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
                      <img src={bannerForm.imageUrl} alt="Prévia banner" className="admin-banner-preview" />
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
                  {savingBanner ? 'Salvando...' : editingBannerId ? 'Salvar banner' : bannerCreateCtaLabel(bannerTotal)}
                </button>
              </form>
            ) : (
              <p className="admin-empty" style={{ marginBottom: 20 }}>
                Limite de {MAX_HOME_BANNERS} banners atingido. Edite ou exclua um para adicionar outro.
              </p>
            )}

            <div className="admin-dense-list">
              {storePayload === 'ready'
                ? banners.map((b, i) => (
                    <div key={b.id} className={`admin-dense-row${b.active ? '' : ' admin-dense-row--muted'}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={b.imageUrl} alt={b.alt || b.title || 'Banner'} className="admin-banner-thumb" />
                      <div className="admin-dense-row__main">
                        <div className="admin-dense-row__title">
                          <b>{b.title || '(sem título)'}</b>
                          <AdminStatusChip label={bannerActiveLabel(b.active)} tone={b.active ? 'ok' : 'neutral'} />
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
                  ))
                : null}
              {storePayload === 'ready' && !banners.length ? (
                <p className="admin-empty">Nenhum banner ainda. Crie o primeiro acima.</p>
              ) : null}
              {storePayload !== 'ready' ? (
                <p className="admin-empty">
                  {storePayload === 'error' ? 'Vitrine indisponível. Nenhum banner foi estimado.' : 'Lendo GET /admin/banners…'}
                </p>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
