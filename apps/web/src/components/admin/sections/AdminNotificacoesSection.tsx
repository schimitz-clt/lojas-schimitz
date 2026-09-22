'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AdminStatusChip } from '@/components/admin/AdminStatusChip';
import { AdminPrimeCommand, scrollAdminAnchor } from '@/components/admin/AdminPrimeCommand';
import {
  NOTIFICACOES_DO_LEDE,
  NOTIFICACOES_EVIDENCE_LEDE,
  NOTIFICACOES_NOW_LEDE,
  notificacoesPrimeModel,
  type PrimeLoad,
} from '@/lib/admin-prime-sections-ui';
import {
  abandonedViewAdminNote,
  abandonedViewPreviewLine,
  campaignResultLine,
  emptyPushCampaignForm,
  firebaseStatusHint,
  isNaoExecutado,
  pushAudienceLabel,
  pushStatusLabel,
  pushStatusTone,
  scheduledAtIso,
  validatePushCampaignForm,
  type PushCampaignForm,
} from '@/lib/push-campaign-ui';
import { formatAdminDateTime } from '@/lib/admin-customers-ui';

type FirebaseStatus = {
  firebaseConfigured?: boolean;
  firebaseSource?: string | null;
  firebaseProjectId?: string | null;
  note?: string;
};

type CampaignRow = {
  id: string;
  title: string;
  body: string;
  imageUrl?: string | null;
  linkPath: string;
  audience: string;
  status: string;
  scheduledAt?: string | null;
  sentAt?: string | null;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  errorSummary?: string | null;
  firebaseReady?: boolean;
  createdAt: string;
};

type TokenRow = {
  id: string;
  platform: string;
  enabled: boolean;
  lastSeenAt: string;
  appVersion?: string | null;
  userBound: boolean;
  hasOrders: boolean;
};

type AbandonedPreview = {
  openViews?: number;
  dueViews?: number;
  sentLast7Days?: number;
  note?: string;
};

type ListData = {
  total: number;
  enabledDevices: number;
  firebase: FirebaseStatus;
  items: CampaignRow[];
};

const ANCHOR: Record<string, string> = {
  push_firebase_off: 'admin-notificacoes-form',
  push_campaigns_failed: 'admin-notificacoes-history',
  push_scheduled: 'admin-notificacoes-history',
  push_abandoned_due: 'admin-notificacoes-abandoned',
  create: 'admin-notificacoes-form',
  history: 'admin-notificacoes-history',
  tokens: 'admin-notificacoes-tokens',
  devices: 'admin-notificacoes-tokens',
  firebase: 'admin-notificacoes-form',
  campaigns: 'admin-notificacoes-history',
  abandoned: 'admin-notificacoes-abandoned',
};

export function AdminNotificacoesSection() {
  const [form, setForm] = useState<PushCampaignForm>(emptyPushCampaignForm);
  const [campaigns, setCampaigns] = useState<CampaignRow[] | null>(null);
  const [tokens, setTokens] = useState<TokenRow[] | null>(null);
  const [firebase, setFirebase] = useState<FirebaseStatus | null>(null);
  const [enabledDevices, setEnabledDevices] = useState<number | null>(null);
  const [abandoned, setAbandoned] = useState<AbandonedPreview | null>(null);
  const [loadState, setLoadState] = useState<PrimeLoad>('pending');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadState((prev) => (prev === 'ready' ? prev : 'pending'));
    const [list, tokenList, preview] = await Promise.all([
      api<ListData>('/admin/push/campaigns'),
      api<{ items: TokenRow[]; enabledCount: number }>('/admin/push/tokens'),
      api<AbandonedPreview>('/admin/push/abandoned-views').catch(() => null),
    ]);
    setCampaigns(list.items || []);
    setFirebase(list.firebase || {});
    setEnabledDevices(typeof list.enabledDevices === 'number' && Number.isFinite(list.enabledDevices) ? list.enabledDevices : null);
    setTokens(tokenList.items || []);
    setAbandoned(preview);
    setLoadState('ready');
  }, []);

  useEffect(() => {
    load().catch((e: Error) => {
      setLoadState((prev) => (prev === 'ready' ? prev : 'error'));
      setErr(e.message || 'Falha ao carregar notificações push');
    });
  }, [load]);

  async function saveCampaign(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setMsg('');
    const invalid = validatePushCampaignForm(form);
    if (invalid) {
      setErr(invalid);
      return;
    }
    setBusy(true);
    try {
      await api('/admin/push/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title.trim(),
          body: form.body.trim(),
          imageUrl: form.imageUrl.trim() || undefined,
          linkPath: form.linkPath.trim() || '/',
          audience: form.audience,
          sendMode: form.sendMode,
          scheduledAt: scheduledAtIso(form),
        }),
      });
      setForm(emptyPushCampaignForm());
      setMsg(form.sendMode === 'scheduled' ? 'Campanha agendada.' : 'Campanha disparada.');
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Falha ao criar campanha');
    } finally {
      setBusy(false);
    }
  }

  async function cancelCampaign(id: string) {
    setBusy(true);
    setErr('');
    try {
      await api(`/admin/push/campaigns/${id}/cancel`, { method: 'POST' });
      setMsg('Campanha cancelada.');
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Falha ao cancelar');
    } finally {
      setBusy(false);
    }
  }

  async function testToken(tokenId: string) {
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const r = await api<{ sent: boolean; reason?: string }>('/admin/push/test', {
        method: 'POST',
        body: JSON.stringify({ tokenId }),
      });
      setMsg(
        r.sent
          ? 'Teste enviado para o aparelho.'
          : r.reason === 'nao_executado'
            ? 'NÃO EXECUTADO: configure o Firebase Admin no Railway.'
            : 'Teste não enviado.',
      );
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Falha no envio de teste');
    } finally {
      setBusy(false);
    }
  }

  const hint = firebaseStatusHint(firebase || {});
  const ready = loadState === 'ready';
  const model = notificacoesPrimeModel({
    load: loadState,
    enabledDevices: ready ? enabledDevices : null,
    firebaseConfigured: ready && firebase && typeof firebase.firebaseConfigured === 'boolean' ? firebase.firebaseConfigured : null,
    campaigns: ready ? campaigns : null,
    tokenCount: ready && tokens ? tokens.length : null,
    abandoned: ready ? abandoned : null,
  });
  const campaignRows = ready ? campaigns || [] : [];
  const tokenRows = ready ? tokens || [] : [];

  function go(id: string) {
    const anchor = ANCHOR[id];
    if (anchor) scrollAdminAnchor(anchor);
  }

  return (
    <>
      <AdminPrimeCommand
        eyebrow="Notificações"
        title="Push do app, sem misturar com o e-mail da loja."
        endpoint="GET /admin/push/campaigns · GET /admin/push/tokens · GET /admin/push/abandoned-views"
        busy={busy}
        onRefresh={() => {
          load().catch((e: Error) => {
            setLoadState((prev) => (prev === 'ready' ? prev : 'error'));
            setErr(e.message || 'Falha ao carregar notificações push');
          });
        }}
        nowLede={NOTIFICACOES_NOW_LEDE}
        summary={model.summary}
        kpis={model.kpis}
        onKpi={go}
        load={loadState}
        attention={model.attention}
        signals={model.signals}
        onAttention={go}
        doLede={NOTIFICACOES_DO_LEDE}
        actions={model.actions}
        onAction={go}
      />

      <div className="admin-section-panel">
        <p className="admin-ent-kicker">Evidência</p>
        <h2 className="admin-cc-block__title">Campanhas e aparelhos</h2>
        <p className="admin-cc-block__lede">{NOTIFICACOES_EVIDENCE_LEDE}</p>
        <p className="admin-section-intro">
          Push promocional no app Android (FCM). Não altera checkout, Mercado Pago nem o sino da Conta (notificações
          in-app de pedido). Público v1: aparelhos com token ativo, ou clientes com pedidos.
        </p>
        <p className="muted" style={{ marginTop: 8 }}>
          {ready ? hint.text : '—'}
        </p>
        <p className="muted" id="admin-notificacoes-abandoned" style={{ marginTop: 8 }}>
          {abandoned?.note || abandonedViewAdminNote()}
          {abandoned ? ` ${abandonedViewPreviewLine(abandoned)}` : ''}
        </p>

        <section className="admin-card-pro" id="admin-notificacoes-form">
          <div className="body">
            <h2>Nova campanha</h2>
            <form className="form admin-form-pro" style={{ marginTop: 12 }} onSubmit={saveCampaign}>
              <label>
                Título *
                <input
                  value={form.title}
                  maxLength={80}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ex.: Frete grátis hoje"
                  required
                />
              </label>
              <label>
                Mensagem *
                <textarea
                  value={form.body}
                  maxLength={240}
                  rows={3}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  placeholder="Texto curto da notificação"
                  required
                />
              </label>
              <div className="row" style={{ alignItems: 'stretch' }}>
                <label style={{ flex: 1 }}>
                  Link / rota da loja
                  <input
                    value={form.linkPath}
                    onChange={(e) => setForm({ ...form, linkPath: e.target.value })}
                    placeholder="/produto/slug ou /"
                  />
                </label>
                <label style={{ flex: 1 }}>
                  Imagem (HTTPS, opcional)
                  <input
                    value={form.imageUrl}
                    onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                    placeholder="https://lojasschimitz.com.br/..."
                  />
                </label>
              </div>
              <div className="row" style={{ alignItems: 'stretch' }}>
                <label style={{ flex: 1 }}>
                  Público
                  <select
                    value={form.audience}
                    onChange={(e) => setForm({ ...form, audience: e.target.value as PushCampaignForm['audience'] })}
                  >
                    <option value="all_enabled">Todos os aparelhos com push ativo</option>
                    <option value="with_orders">Clientes com pedidos</option>
                  </select>
                </label>
                <label style={{ flex: 1 }}>
                  Envio
                  <select
                    value={form.sendMode}
                    onChange={(e) => setForm({ ...form, sendMode: e.target.value as PushCampaignForm['sendMode'] })}
                  >
                    <option value="immediate">Enviar agora</option>
                    <option value="scheduled">Agendar</option>
                  </select>
                </label>
              </div>
              {form.sendMode === 'scheduled' ? (
                <label>
                  Data e hora
                  <input
                    type="datetime-local"
                    value={form.scheduledAt}
                    onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                    required
                  />
                </label>
              ) : null}
              {err ? <div className="alert">{err}</div> : null}
              {msg ? <div className="ok">{msg}</div> : null}
              <button className="btn admin-btn-primary-accent" type="submit" disabled={busy}>
                {busy ? 'Enviando…' : form.sendMode === 'scheduled' ? 'Agendar campanha' : 'Enviar agora'}
              </button>
            </form>
          </div>
        </section>

        <h3 className="admin-section-heading" id="admin-notificacoes-history">
          Histórico ({ready ? campaignRows.length : '—'})
        </h3>
        <div className="admin-dense-list">
          {!ready ? (
            <p className="muted">{loadState === 'error' ? 'Histórico indisponível.' : 'Lendo campanhas…'}</p>
          ) : campaignRows.length === 0 ? (
            <p className="muted">Nenhuma campanha ainda.</p>
          ) : (
            campaignRows.map((c) => (
              <div key={c.id} className={`admin-dense-row${c.status === 'sent' ? ' admin-dense-row--accent' : ''}`}>
                <div>
                  <strong>{c.title}</strong>
                  <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                    {c.body}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    {pushAudienceLabel(c.audience)} · {c.linkPath} · {formatAdminDateTime(c.createdAt)}
                    {c.scheduledAt ? ` · agendada ${formatAdminDateTime(c.scheduledAt)}` : ''}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    {campaignResultLine(c)}
                  </div>
                </div>
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <AdminStatusChip label={pushStatusLabel(c.status)} tone={pushStatusTone(c.status)} />
                  {c.status === 'scheduled' ? (
                    <button type="button" className="btn ghost" disabled={busy} onClick={() => void cancelCampaign(c.id)}>
                      Cancelar
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>

        <h3 className="admin-section-heading" id="admin-notificacoes-tokens">
          Aparelhos ({ready ? tokenRows.length : '—'})
        </h3>
        <p className="muted">
          Token FCM completo nunca aparece aqui. Use “Enviar teste” no seu aparelho depois de abrir o app logado.
        </p>
        <div className="admin-dense-list">
          {!ready ? (
            <p className="muted">{loadState === 'error' ? 'Aparelhos indisponíveis.' : 'Lendo tokens…'}</p>
          ) : tokenRows.length === 0 ? (
            <p className="muted">Nenhum token registrado ainda.</p>
          ) : (
            tokenRows.map((t) => (
              <div key={t.id} className="admin-dense-row">
                <div>
                  <code style={{ fontSize: 12 }}>{t.id}</code>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    {t.platform}
                    {t.enabled ? ' · ativo' : ' · desligado'}
                    {t.userBound ? ' · conta vinculada' : ' · visitante'}
                    {t.hasOrders ? ' · tem pedidos' : ''}
                    {t.appVersion ? ` · app ${t.appVersion}` : ''}
                    {' · '}
                    {formatAdminDateTime(t.lastSeenAt)}
                  </div>
                </div>
                <button type="button" className="btn ghost" disabled={busy || !t.enabled} onClick={() => void testToken(t.id)}>
                  Enviar teste
                </button>
              </div>
            ))
          )}
        </div>
        {ready && (isNaoExecutado(firebase?.note) || !firebase?.firebaseConfigured) ? (
          <p className="muted" style={{ marginTop: 16 }}>
            Checklist do dono: <code>docs/PUSH-FCM.md</code>
          </p>
        ) : null}
      </div>
    </>
  );
}
