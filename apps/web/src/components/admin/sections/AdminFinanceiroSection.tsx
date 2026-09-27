'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, brl } from '@/lib/api';
import { AdminStatusChip } from '@/components/admin/AdminStatusChip';
import {
  FINANCE_ACTION_LABEL_PT,
  FINANCE_MISSING,
  PAYMENT_STATE_LABEL_PT,
  SEVERITY_LABEL_PT,
  parseRefundAmount,
  refundableFromDetail,
  severityTone,
  sortDiscrepancies,
  validateFinanceAction,
  type FinanceActionKind,
  type Severity,
} from '@/lib/admin-finance-ui';

type Agg = { amount: number; count: number };
type Dashboard = {
  generatedAt: string;
  receivedToday: Agg;
  refundedToday: Agg;
  pending: Agg;
  underReview: Agg;
  refundedTotal: Agg;
  chargebacksOpen: Agg;
  chargebacksLost: Agg;
  discrepancies: Record<Severity, number>;
  lastReconciliation: { id: string; scope: string; status: string; startedAt: string } | null;
  notes: string[];
};
type PaymentRow = {
  id: string;
  method: string;
  status: string;
  state: string;
  reviewStatus: string | null;
  externalId: string | null;
  amount: number;
  createdAt: string;
  order: { publicId: string; status: string; total: number };
};
type Discrepancy = { id: string; type: string; severity: string; status: string; message: string; orderId: string | null; paymentId: string | null; conditionCleared: boolean; occurrences: number; lastSeenAt: string };
type Chargeback = { id: string; providerCaseId: string; status: string; amount: number | null; paymentId: string | null; documentationDeadline: string | null; lastFetchError: string | null; createdAt: string };
type Refund = { id: string; paymentId: string; amount: number; status: string; isFull: boolean; reason: string; lastError: string | null; createdAt: string };
type PaymentDetail = {
  payment: PaymentRow & { order: PaymentRow['order'] & { id: string } };
  transitions: { id: string; fromState: string | null; toState: string; source: string; createdAt: string; reason: string | null }[];
  ledger: { id: string; entryType: string; direction: string; amount: number; source: string; createdAt: string }[];
  refunds: Refund[];
  discrepancies: Discrepancy[];
};

type Tab = 'pagamentos' | 'divergencias' | 'chargebacks' | 'estornos';
type PendingAction = { kind: FinanceActionKind; paymentId?: string; discrepancy?: Discrepancy; orderId?: string } | null;

const fmtDate = (s: string | null | undefined) => (s ? new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : FINANCE_MISSING);
const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k-${Date.now()}-${performance.now()}`);

function Kpi({ label, agg, hint }: { label: string; agg: Agg | null | undefined; hint?: string }) {
  return (
    <div className="admin-cc-kpi">
      <span className="admin-cc-kpi__label">{label}</span>
      <strong className="admin-cc-kpi__value">{agg ? brl(agg.amount) : FINANCE_MISSING}</strong>
      <span className="admin-cc-kpi__hint">{agg ? `${agg.count} registro(s)` : 'sem dados'}{hint ? ` · ${hint}` : ''}</span>
    </div>
  );
}

export function AdminFinanceiroSection() {
  const [tab, setTab] = useState<Tab>('pagamentos');
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [chargebacks, setChargebacks] = useState<Chargeback[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [filters, setFilters] = useState({ status: '', method: '', state: '', q: '' });
  const [detail, setDetail] = useState<PaymentDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<PendingAction>(null);
  const [form, setForm] = useState({ reason: '', confirm: false, amount: '' });
  const [idemKey, setIdemKey] = useState(newKey());
  const [busy, setBusy] = useState(false);

  const loadDashboard = useCallback(async () => {
    setDash(await api<Dashboard>('/admin/finance/dashboard'));
  }, []);

  const loadTab = useCallback(async () => {
    if (tab === 'pagamentos') {
      const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
      const r = await api<{ items: PaymentRow[] }>(`/admin/finance/payments${qs ? `?${qs}` : ''}`);
      setPayments(r.items);
    } else if (tab === 'divergencias') {
      setDiscrepancies(sortDiscrepancies(await api<Discrepancy[]>('/admin/finance/discrepancies?status=open')));
    } else if (tab === 'chargebacks') {
      setChargebacks(await api<Chargeback[]>('/admin/finance/chargebacks'));
    } else {
      setRefunds(await api<Refund[]>('/admin/finance/refunds'));
    }
  }, [tab, filters]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      await Promise.all([loadDashboard(), loadTab()]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao carregar o Financeiro');
    } finally {
      setLoading(false);
    }
  }, [loadDashboard, loadTab]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function openDetail(id: string) {
    setErr(null);
    try {
      setDetail(await api<PaymentDetail>(`/admin/finance/payments/${id}`));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao abrir pagamento');
    }
  }

  function startAction(a: NonNullable<PendingAction>) {
    setAction(a);
    setForm({ reason: '', confirm: false, amount: '' });
    setIdemKey(newKey()); // one key per refund dialog: double-click/retry = same refund
    setMsg(null);
    setErr(null);
  }

  async function submitAction() {
    if (!action) return;
    const refundable = refundableFromDetail(detail);
    const problem = validateFinanceAction(action.kind, { ...form, severity: action.discrepancy?.severity }, { refundable });
    if (problem) {
      setErr(problem);
      return;
    }
    const body = { reason: form.reason.trim(), confirm: form.confirm };
    const post = (path: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) =>
      api<unknown>(path, { method: 'POST', body: JSON.stringify({ ...body, ...extra }), headers });
    setBusy(true);
    try {
      switch (action.kind) {
        case 'reprocess':
          await post(`/admin/finance/payments/${action.paymentId}/reprocess`);
          break;
        case 'refund':
          await post(`/admin/finance/payments/${action.paymentId}/refunds`, { amount: parseRefundAmount(form.amount) }, { 'Idempotency-Key': idemKey });
          break;
        case 'review':
        case 'clear_review':
          await post(`/admin/finance/payments/${action.paymentId}/review`, { status: action.kind === 'review' ? 'UNDER_REVIEW' : 'CLEARED' });
          break;
        case 'resolve':
        case 'acknowledge':
          await post(`/admin/finance/discrepancies/${action.discrepancy!.id}/resolve`, { status: action.kind === 'resolve' ? 'RESOLVED' : 'ACKNOWLEDGED' });
          break;
        case 'reconcile_payment':
          await post('/admin/finance/reconcile', { scope: 'PAYMENT', paymentId: action.paymentId });
          break;
        case 'reconcile_period':
          await post('/admin/finance/reconcile', { scope: 'PERIOD', from: new Date(Date.now() - 86_400_000).toISOString() });
          break;
        case 'release_reservation':
          await post(`/admin/finance/orders/${action.orderId}/release-reservation`);
          break;
      }
      setMsg(`${FINANCE_ACTION_LABEL_PT[action.kind]}: concluído (registrado na auditoria).`);
      setAction(null);
      if (action.paymentId && detail) await openDetail(action.paymentId);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ação falhou');
    } finally {
      setBusy(false);
    }
  }

  const disc = dash?.discrepancies;
  return (
    <section className="admin-section-panel" aria-labelledby="admin-financeiro-h">
      <div className="admin-section-intro">
        <p className="admin-ent-kicker">Financeiro</p>
        <h2 id="admin-financeiro-h" className="admin-section-heading">Pagamentos, divergências e estornos</h2>
        <p className="admin-ent-note">
          Números vindos do banco (GET /admin/finance/*). Ações exigem motivo + confirmação e ficam na auditoria financeira.
          {dash ? ` Atualizado ${fmtDate(dash.generatedAt)}.` : ''}
        </p>
      </div>
      {err ? <div className="alert" role="alert">{err}</div> : null}
      {msg ? <div className="ok">{msg}</div> : null}

      <div className="admin-cc-block">
        <div className="row">
          <Kpi label="Recebido hoje" agg={dash?.receivedToday} hint="ledger" />
          <Kpi label="Pendente" agg={dash?.pending} />
          <Kpi label="Em revisão" agg={dash?.underReview} />
          <Kpi label="Estornado (total)" agg={dash?.refundedTotal} />
          <Kpi label="Chargebacks abertos" agg={dash?.chargebacksOpen} />
        </div>
        <p className="admin-ent-note">
          Divergências abertas:{' '}
          {disc ? (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as Severity[]).map((s) => `${SEVERITY_LABEL_PT[s]} ${disc[s] ?? 0}`).join(' · ') : FINANCE_MISSING}
          {' · '}Última reconciliação: {dash?.lastReconciliation ? `${dash.lastReconciliation.status} em ${fmtDate(dash.lastReconciliation.startedAt)}` : 'nunca'}
        </p>
        {dash?.notes?.map((n) => <p key={n} className="muted">{n}</p>)}
        <div className="admin-ent-actions">
          <button type="button" className="btn ghost" onClick={() => void refresh()} disabled={loading}>{loading ? 'Carregando…' : 'Atualizar'}</button>
          <button type="button" className="btn admin-btn-primary-accent" onClick={() => startAction({ kind: 'reconcile_period' })}>{FINANCE_ACTION_LABEL_PT.reconcile_period}</button>
        </div>
      </div>

      <div className="admin-toolbar__row" role="tablist">
        {(['pagamentos', 'divergencias', 'chargebacks', 'estornos'] as Tab[]).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'btn' : 'btn ghost'} onClick={() => setTab(t)}>
            {{ pagamentos: 'Pagamentos', divergencias: 'Divergências', chargebacks: 'Chargebacks', estornos: 'Estornos' }[t]}
          </button>
        ))}
      </div>

      {tab === 'pagamentos' ? (
        <div className="admin-cc-block">
          <form className="form admin-form-pro row" onSubmit={(e) => { e.preventDefault(); void refresh(); }}>
            <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} aria-label="Status">
              <option value="">Status (todos)</option>
              {['pending', 'approved', 'refused', 'expired', 'cancelled', 'refunded'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filters.method} onChange={(e) => setFilters({ ...filters, method: e.target.value })} aria-label="Método">
              <option value="">Método (todos)</option>
              <option value="pix">PIX</option>
              <option value="card">Cartão</option>
            </select>
            <select value={filters.state} onChange={(e) => setFilters({ ...filters, state: e.target.value })} aria-label="Estado financeiro">
              <option value="">Estado financeiro (todos)</option>
              {Object.entries(PAYMENT_STATE_LABEL_PT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} placeholder="Pedido (SCH-…) ou id MP" aria-label="Busca" />
            <button type="submit" className="btn ghost">Filtrar</button>
          </form>
          {payments.length === 0 ? <p className="admin-empty">Nenhum pagamento para os filtros.</p> : (
            <div className="admin-ent-table-wrap">
              <table className="admin-ent-table">
                <thead><tr><th>Pedido</th><th>Método</th><th>Estado</th><th className="num">Valor</th><th>Criado</th><th /></tr></thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td>{p.order.publicId}<div className="muted">{p.order.status}</div></td>
                      <td>{p.method === 'pix' ? 'PIX' : 'Cartão'}</td>
                      <td>
                        <AdminStatusChip label={PAYMENT_STATE_LABEL_PT[p.state] ?? p.state} tone={p.state === 'PAID' ? 'ok' : p.state.startsWith('CHARGEBACK') || p.state === 'IN_DISPUTE' ? 'danger' : 'neutral'} />
                        {p.reviewStatus === 'UNDER_REVIEW' ? <AdminStatusChip label="Em revisão" tone="warn" /> : null}
                      </td>
                      <td className="num">{brl(p.amount)}</td>
                      <td>{fmtDate(p.createdAt)}</td>
                      <td><button type="button" className="btn ghost admin-btn-ghost-pro" onClick={() => void openDetail(p.id)}>Detalhes</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {tab === 'divergencias' ? (
        <div className="admin-dense-list">
          {discrepancies.length === 0 ? <p className="admin-empty">Nenhuma divergência aberta.</p> : discrepancies.map((d) => (
            <div key={d.id} className="admin-card-pro">
              <div className="admin-dense-row__main">
                <AdminStatusChip label={SEVERITY_LABEL_PT[d.severity as Severity] ?? d.severity} tone={severityTone(d.severity)} />{' '}
                <strong className="admin-dense-row__title">{d.type}</strong>
                <p>{d.message}</p>
                <p className="admin-dense-row__meta">
                  {d.occurrences}× · visto {fmtDate(d.lastSeenAt)} · {d.status}{d.conditionCleared ? ' · condição não observada no último run (requer decisão humana)' : ''}
                </p>
              </div>
              <div className="admin-dense-row__actions">
                {d.paymentId ? <button type="button" className="btn ghost" onClick={() => void openDetail(d.paymentId!)}>Pagamento</button> : null}
                {d.type === 'RESERVATION_WITHOUT_PAYMENT' && d.orderId ? <button type="button" className="btn ghost" onClick={() => startAction({ kind: 'release_reservation', orderId: d.orderId! })}>Liberar reserva</button> : null}
                <button type="button" className="btn ghost" onClick={() => startAction({ kind: 'acknowledge', discrepancy: d })}>Reconhecer</button>
                <button type="button" className="btn" onClick={() => startAction({ kind: 'resolve', discrepancy: d })}>Resolver</button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {tab === 'chargebacks' ? (
        chargebacks.length === 0 ? <p className="admin-empty">Nenhum chargeback registrado.</p> : (
          <div className="admin-ent-table-wrap">
            <table className="admin-ent-table">
              <thead><tr><th>Caso MP</th><th>Status</th><th className="num">Valor</th><th>Prazo documentação</th><th>Observação</th><th /></tr></thead>
              <tbody>
                {chargebacks.map((c) => (
                  <tr key={c.id}>
                    <td>{c.providerCaseId}</td>
                    <td><AdminStatusChip label={c.status} tone={c.status === 'LOST' ? 'danger' : c.status === 'WON' ? 'ok' : 'warn'} /></td>
                    <td className="num">{c.amount != null ? brl(c.amount) : FINANCE_MISSING}</td>
                    <td>{fmtDate(c.documentationDeadline)}</td>
                    <td className="muted">{c.lastFetchError ? `Consulta MP falhou: ${c.lastFetchError}` : 'Documentação é enviada pelo painel do Mercado Pago'}</td>
                    <td>{c.paymentId ? <button type="button" className="btn ghost" onClick={() => void openDetail(c.paymentId!)}>Pagamento</button> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {tab === 'estornos' ? (
        refunds.length === 0 ? <p className="admin-empty">Nenhum estorno solicitado pelo Financeiro.</p> : (
          <div className="admin-ent-table-wrap">
            <table className="admin-ent-table">
              <thead><tr><th>Estorno</th><th>Status</th><th className="num">Valor</th><th>Motivo</th><th>Criado</th></tr></thead>
              <tbody>
                {refunds.map((r) => (
                  <tr key={r.id}>
                    <td>{r.isFull ? 'Total' : 'Parcial'}<div className="muted">{r.id.slice(0, 8)}</div></td>
                    <td><AdminStatusChip label={r.status} tone={r.status === 'COMPLETED' ? 'ok' : r.status === 'FAILED' ? 'danger' : 'warn'} />{r.lastError ? <div className="muted">{r.lastError}</div> : null}</td>
                    <td className="num">{brl(r.amount)}</td>
                    <td>{r.reason}</td>
                    <td>{fmtDate(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {detail ? (
        <div className="admin-cc-block" aria-label="Detalhe do pagamento">
          <h3 className="admin-cc-block__title">
            Pagamento {detail.payment.order.publicId} · {PAYMENT_STATE_LABEL_PT[detail.payment.state] ?? detail.payment.state} · {brl(detail.payment.amount)}
          </h3>
          <p className="admin-cc-block__lede">MP {detail.payment.externalId ?? FINANCE_MISSING} · pedido {detail.payment.order.status} · disponível p/ estorno {brl(refundableFromDetail(detail) ?? 0)}</p>
          <div className="admin-ent-actions">
            <button type="button" className="btn ghost" onClick={() => startAction({ kind: 'reprocess', paymentId: detail.payment.id })}>Reprocessar</button>
            <button type="button" className="btn ghost" onClick={() => startAction({ kind: 'reconcile_payment', paymentId: detail.payment.id })}>Reconciliar</button>
            {detail.payment.reviewStatus === 'UNDER_REVIEW'
              ? <button type="button" className="btn ghost" onClick={() => startAction({ kind: 'clear_review', paymentId: detail.payment.id })}>Liberar revisão</button>
              : <button type="button" className="btn ghost" onClick={() => startAction({ kind: 'review', paymentId: detail.payment.id })}>Marcar revisão</button>}
            <button type="button" className="btn" onClick={() => startAction({ kind: 'refund', paymentId: detail.payment.id })}>Solicitar estorno</button>
            <button type="button" className="btn ghost" onClick={() => setDetail(null)}>Fechar</button>
          </div>
          <h4 className="admin-ent-h">Transições</h4>
          <ul className="admin-dense-list">
            {detail.transitions.map((t) => <li key={t.id}>{fmtDate(t.createdAt)} · {t.fromState ?? '∅'} → {t.toState} · {t.source}{t.reason ? ` · ${t.reason}` : ''}</li>)}
          </ul>
          <h4 className="admin-ent-h">Ledger (somente inclusão)</h4>
          <ul className="admin-dense-list">
            {detail.ledger.map((l) => <li key={l.id}>{fmtDate(l.createdAt)} · {l.entryType} · {l.direction} {brl(l.amount)} · {l.source}</li>)}
          </ul>
        </div>
      ) : null}

      {action ? (
        <div className="admin-cc-block" role="dialog" aria-modal="true" aria-labelledby="fin-action-h">
          <h3 id="fin-action-h" className="admin-cc-block__title">{FINANCE_ACTION_LABEL_PT[action.kind]}</h3>
          {action.kind === 'refund' ? (
            <p className="admin-ent-note">Estorno real no Mercado Pago (se habilitado no servidor). Deixe o valor vazio para estornar todo o saldo disponível.</p>
          ) : null}
          <div className="form admin-form-pro">
            {action.kind === 'refund' ? (
              <label>Valor (R$, opcional)
                <input inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="ex.: 49,90" />
              </label>
            ) : null}
            <label>Motivo (obrigatório)
              <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={3} maxLength={500} />
            </label>
            <label>
              <input type="checkbox" checked={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.checked })} /> Confirmo esta ação (fica registrada com meu usuário)
            </label>
            <div className="admin-ent-actions">
              <button type="button" className="btn admin-btn-primary-accent" disabled={busy} onClick={() => void submitAction()}>{busy ? 'Enviando…' : 'Confirmar'}</button>
              <button type="button" className="btn ghost" disabled={busy} onClick={() => setAction(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
