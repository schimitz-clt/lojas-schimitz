'use client';

import { brl } from '@/lib/api';
import { ENTERPRISE_MISSING, moneyOrDash } from '@/lib/admin-enterprise-ui';
import { formatAdminDate } from '@/lib/admin-customers-ui';
import {
  CUPONS_DO_LEDE,
  CUPONS_EVIDENCE_LEDE,
  CUPONS_NOW_LEDE,
  cuponsPrimeModel,
} from '@/lib/admin-prime-sections-ui';
import { AdminPrimeCommand, scrollAdminAnchor } from '@/components/admin/AdminPrimeCommand';
import { AdminStatusChip } from '@/components/admin/AdminStatusChip';
import { couponIsExhausted, couponIsExpired, couponNotStarted, couponStartsAtLine } from '@/lib/admin-pro-ui';
import { useAdminConsole } from '@/components/admin/admin-console-context';

const ANCHOR: Record<string, string> = {
  coupons_expired_active: 'admin-cupons-list',
  coupons_exhausted_active: 'admin-cupons-list',
  coupons_not_started: 'admin-cupons-list',
  create: 'admin-cupons-form',
  list: 'admin-cupons-list',
  total: 'admin-cupons-list',
  active: 'admin-cupons-list',
  uses: 'admin-cupons-list',
  reserved: 'admin-cupons-list',
};

export function AdminCuponsSection() {
  const { coupons, couponForm, setCouponForm, savingCoupon, saveCoupon, toggleCoupon, storePayload, load } =
    useAdminConsole();

  const model = cuponsPrimeModel({
    load: storePayload,
    coupons: storePayload === 'ready' ? coupons : null,
  });

  function go(id: string) {
    const anchor = ANCHOR[id];
    if (anchor) scrollAdminAnchor(anchor);
  }

  return (
    <>
      <AdminPrimeCommand
        eyebrow="Cupons"
        title="Descontos reais, um GET /admin/coupons."
        endpoint="GET /admin/coupons · POST /admin/coupons · PATCH /admin/coupons/:id"
        busy={savingCoupon}
        onRefresh={() => void load()}
        nowLede={CUPONS_NOW_LEDE}
        summary={model.summary}
        kpis={model.kpis}
        onKpi={go}
        load={storePayload}
        attention={model.attention}
        signals={model.signals}
        onAttention={go}
        doLede={CUPONS_DO_LEDE}
        actions={model.actions}
        onAction={go}
      />

      <div className="admin-section-panel" id="admin-cupons-evidence">
        <p className="admin-ent-kicker">Evidência</p>
        <h2 className="admin-cc-block__title">Códigos que a sacola já aceita</h2>
        <p className="admin-cc-block__lede">{CUPONS_EVIDENCE_LEDE}</p>
        <p className="admin-ent-note">
          Piloto: SCHIMITZ10 (10%) — o seed cria se ainda não existir. Não crie cupom percentual que
          duplique o 5% automático do PIX (código PIX5 está aposentado/colidente).
        </p>

        <section className="admin-card-pro" id="admin-cupons-form">
          <div className="body">
            <h2>Novo cupom</h2>
            <form className="form admin-form-pro" style={{ marginTop: 12, marginBottom: 0 }} onSubmit={saveCoupon}>
              <div className="row" style={{ alignItems: 'stretch' }}>
                <label style={{ flex: 1 }}>
                  Código *
                  <input
                    value={couponForm.code}
                    onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                    placeholder="EX.: SCHIMITZ10"
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
                  Início (opcional)
                  <input
                    type="date"
                    value={couponForm.startsAt}
                    onChange={(e) => setCouponForm({ ...couponForm, startsAt: e.target.value })}
                  />
                </label>
                <label style={{ flex: 1 }}>
                  Validade (opcional)
                  <input
                    type="date"
                    value={couponForm.endsAt}
                    onChange={(e) => setCouponForm({ ...couponForm, endsAt: e.target.value })}
                  />
                </label>
              </div>
              <div className="row" style={{ alignItems: 'stretch' }}>
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

        <h3 className="admin-section-heading" id="admin-cupons-list">
          Cupons ({storePayload === 'ready' ? coupons.length : ENTERPRISE_MISSING})
        </h3>
        <div className="admin-dense-list">
          {storePayload === 'ready'
            ? coupons.map((c) => {
                const expired = couponIsExpired(c.endsAt);
                const notStarted = couponNotStarted(c.startsAt);
                const exhausted = couponIsExhausted(c.maxUses, c.usedCount);
                return (
                  <div
                    key={c.id}
                    className={`admin-dense-row${c.active ? ' admin-dense-row--accent' : ' admin-dense-row--muted'}`}
                  >
                    <div className="admin-dense-row__main">
                      <div className="admin-dense-row__title">
                        <span className="admin-dense-row__code">{c.code}</span>
                        <AdminStatusChip label={c.type === 'percent' ? `${c.value}%` : brl(c.value)} tone="accent" />
                        <AdminStatusChip label={c.active ? 'Ativo' : 'Inativo'} tone={c.active ? 'ok' : 'neutral'} />
                        {expired ? <AdminStatusChip label="Expirado" tone="danger" /> : null}
                        {notStarted ? <AdminStatusChip label="Ainda não começou" tone="info" /> : null}
                        {exhausted ? <AdminStatusChip label="Esgotado" tone="warn" /> : null}
                      </div>
                      <div className="admin-dense-row__meta">
                        {c.minSubtotal != null ? `Mín. ${moneyOrDash(c.minSubtotal)} · ` : ''}
                        {couponStartsAtLine(c.startsAt)}
                        {' · '}
                        {c.endsAt ? `válido até ${formatAdminDate(c.endsAt)} · ` : 'sem validade · '}
                        usos {c.usedCount}
                        {c.maxUses != null ? `/${c.maxUses}` : ''}
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
              })
            : null}
          {storePayload === 'ready' && !coupons.length ? (
            <p className="admin-empty">
              Nenhum cupom ainda. Crie SCHIMITZ10 (10%) acima — vale na sacola e no checkout.
            </p>
          ) : null}
          {storePayload !== 'ready' ? (
            <p className="admin-empty">
              {storePayload === 'error' ? 'Cupons indisponíveis. Nenhum uso foi estimado.' : 'Lendo GET /admin/coupons…'}
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}
