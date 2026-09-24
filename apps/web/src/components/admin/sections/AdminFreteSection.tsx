'use client';

import { brl } from '@/lib/api';
import { moneyOrDash } from '@/lib/admin-enterprise-ui';
import {
  FRETE_DO_LEDE,
  FRETE_EVIDENCE_LEDE,
  FRETE_NOW_LEDE,
  fretePrimeModel,
} from '@/lib/admin-prime-sections-ui';
import { AdminPrimeCommand, scrollAdminAnchor } from '@/components/admin/AdminPrimeCommand';
import { AdminStatusChip } from '@/components/admin/AdminStatusChip';
import { shippingSortOrderLine, shippingZoneActiveLabel } from '@/lib/admin-pro-ui';
import { useAdminConsole } from '@/components/admin/admin-console-context';

const ANCHOR: Record<string, string> = {
  shipping_no_zones: 'admin-frete-zones',
  shipping_no_active_zone: 'admin-frete-zones',
  settings: 'admin-frete-settings',
  zones: 'admin-frete-zones',
  free: 'admin-frete-settings',
  fee: 'admin-frete-settings',
  days: 'admin-frete-settings',
};

export function AdminFreteSection() {
  const {
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
    storePayload,
    load,
  } = useAdminConsole();

  const model = fretePrimeModel({
    load: storePayload,
    settings: storePayload === 'ready' ? shippingSettings : null,
    rules: storePayload === 'ready' ? shippingRules : null,
  });

  function go(id: string) {
    const anchor = ANCHOR[id];
    if (anchor) scrollAdminAnchor(anchor);
  }

  return (
    <>
      <AdminPrimeCommand
        eyebrow="Frete"
        title="Entrega própria, um GET /admin/shipping."
        endpoint="GET /admin/shipping · PATCH /admin/shipping/settings · POST/PATCH/DELETE /admin/shipping/rules"
        busy={savingShipping || savingCepRule}
        onRefresh={() => void load()}
        nowLede={FRETE_NOW_LEDE}
        summary={model.summary}
        kpis={model.kpis}
        onKpi={go}
        load={storePayload}
        attention={model.attention}
        signals={model.signals}
        onAttention={go}
        doLede={FRETE_DO_LEDE}
        actions={model.actions}
        onAction={go}
      />

      <div className="admin-section-panel" id="admin-frete-evidence">
        <p className="admin-ent-kicker">Evidência</p>
        <h2 className="admin-cc-block__title">O que a entrega usa</h2>
        <p className="admin-cc-block__lede">{FRETE_EVIDENCE_LEDE}</p>
        {storePayload === 'ready' && shippingSettings ? (
          <div className="admin-ent-facts">
            <div className="admin-ent-fact">
              <span>Grátis a partir de</span>
              <strong>{moneyOrDash(shippingSettings.freeAbove)}</strong>
            </div>
            <div className="admin-ent-fact">
              <span>Taxa padrão</span>
              <strong>{moneyOrDash(shippingSettings.defaultFee)}</strong>
            </div>
            <div className="admin-ent-fact">
              <span>Prazo padrão</span>
              <strong>{shippingSettings.defaultDays} dias</strong>
            </div>
          </div>
        ) : (
          <p className="admin-ent-note">— · a configuração ainda não veio.</p>
        )}

        <section className="admin-card-pro" id="admin-frete-settings">
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
                  {shippingSettings.defaultDays} dias. Taxa e prazo padrão não são a cotação da vitrine. Com Melhor
                  Envio configurado, preço e prazo vêm do cálculo; zona com taxa R$ 0 (CEP 90 e 91) deixa o frete
                  grátis e usa o prazo calculado.
                </p>
              ) : null}
            </form>
          </div>
        </section>

        <section className="admin-card-pro" id="admin-frete-zones">
          <div className="body">
            <h2>Zonas por CEP</h2>
            <form className="form admin-form-pro" onSubmit={saveCepRule} style={{ marginTop: 12, marginBottom: 14 }}>
              <div className="row" style={{ alignItems: 'stretch' }}>
                <label style={{ flex: 1 }}>
                  Prefixo CEP *
                  <input
                    value={cepRuleForm.cepPrefix}
                    onChange={(e) =>
                      setCepRuleForm({ ...cepRuleForm, cepPrefix: e.target.value.replace(/\D/g, '').slice(0, 8) })
                    }
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
              {storePayload === 'ready'
                ? shippingRules.map((r) => (
                    <div key={r.id} className={`admin-dense-row${r.active ? '' : ' admin-dense-row--muted'}`}>
                      <div className="admin-dense-row__main">
                        <div className="admin-dense-row__title">
                          <b>CEP {r.cepPrefix}…</b>
                          <AdminStatusChip label={shippingZoneActiveLabel(r.active)} tone={r.active ? 'ok' : 'neutral'} />
                        </div>
                        <div className="admin-dense-row__meta">
                          {brl(r.fee)} · {r.estimatedDays} dia{r.estimatedDays === 1 ? '' : 's'}
                          {Number(r.fee) === 0 ? ' · taxa 0 = cliente não paga; prazo da cotação' : ''}
                          {r.label ? ` · ${r.label}` : ''}
                          {` · ${shippingSortOrderLine(r.sortOrder)}`}
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
                  ))
                : null}
              {storePayload === 'ready' && !shippingRules.length ? (
                <p className="admin-empty">
                  Nenhuma zona ainda. Sem zona de taxa zero, nenhum CEP fica grátis por regra — a cotação vale para o
                  cliente.
                </p>
              ) : null}
              {storePayload !== 'ready' ? (
                <p className="admin-empty">
                  {storePayload === 'error' ? 'Frete indisponível. Nenhuma zona foi estimada.' : 'Lendo GET /admin/shipping…'}
                </p>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
