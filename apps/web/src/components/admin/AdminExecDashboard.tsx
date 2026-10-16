'use client';

import Link from 'next/link';
import { brl } from '@/lib/api';
import {
  EXEC_PERIODS,
  execHealthValue,
  execPeriodLabel,
  execPriorityList,
  execSeverityLabel,
  type ExecPeriod,
  type ExecWindow,
} from '@/lib/admin-exec-dashboard';
import type { AdminOpsAlert } from '@/components/admin/admin-console-model';

export type ExecQuickAction = { id: string; label: string; hint: string; figure?: string | null; href?: string; onClick?: () => void };
export type ExecHealthItem = { label: string; value: number | null | undefined; tone?: 'ok' | 'warn' | 'danger'; href?: string };

/** Painel executivo: KPIs do período, prioridades com ação, ações rápidas e saúde da loja. Só dados reais. */
export function AdminExecDashboard({
  ready,
  failed,
  period,
  onPeriod,
  win,
  awaiting,
  alerts,
  onResolve,
  actions,
  health,
}: {
  ready: boolean;
  failed: boolean;
  period: ExecPeriod;
  onPeriod: (p: ExecPeriod) => void;
  win: ExecWindow | null;
  awaiting: number | null | undefined;
  alerts: AdminOpsAlert[];
  onResolve: (a: AdminOpsAlert) => void;
  actions: ExecQuickAction[];
  health: ExecHealthItem[];
}) {
  const dash = ready ? null : failed ? 'Indisponível' : 'Carregando…';
  const pri = execPriorityList(alerts.filter((a) => a.severity !== 'info'), 6);
  const kpis = [
    { key: 'rev', label: 'Receita', value: win ? brl(win.revenue) : null, sub: execPeriodLabel(period) },
    { key: 'ord', label: 'Pedidos pagos', value: win ? String(win.orders) : null, sub: execPeriodLabel(period) },
    { key: 'tkt', label: 'Ticket médio', value: win ? (win.ticket != null ? brl(win.ticket) : '—') : null, sub: win && win.ticket == null ? 'sem vendas no período' : 'por pedido pago' },
    { key: 'org', label: 'A organizar', value: awaiting != null ? String(awaiting) : null, sub: 'pedidos pagos esperando', tone: awaiting ? 'warn' : '' },
  ];
  return (
    <section className="admin-exec" aria-label="Painel executivo">
      <div className="admin-exec__bar">
        <h2 className="admin-exec__h">Resultados</h2>
        <div className="admin-exec__seg" role="group" aria-label="Período">
          {EXEC_PERIODS.map((p) => (
            <button key={p.id} type="button" aria-pressed={period === p.id} className={period === p.id ? 'is-on' : ''} onClick={() => onPeriod(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="admin-exec__kpis">
        {kpis.map((k) => (
          <article key={k.key} className={`admin-exec__kpi${k.tone ? ` is-${k.tone}` : ''}`}>
            <p className="admin-exec__kpi-label">{k.label}</p>
            <p className="admin-exec__kpi-value">{k.value ?? dash ?? 'Sem dados ainda'}</p>
            <p className="admin-exec__kpi-sub">{k.sub}</p>
          </article>
        ))}
      </div>
      <div className="admin-exec__grid">
        <section className="admin-exec__card" aria-labelledby="exec-pri">
          <h3 id="exec-pri" className="admin-exec__card-h">
            Prioridades <span className="admin-exec__count">{ready ? pri.items.length + pri.hidden : '—'}</span>
          </h3>
          {!ready ? (
            <p className="admin-exec__empty">{dash}</p>
          ) : pri.items.length === 0 ? (
            <p className="admin-exec__empty">Tudo em dia. Nenhum problema pedindo ação agora.</p>
          ) : (
            <ol className="admin-exec__alerts">
              {pri.items.map((a) => (
                <li key={a.code} className={`admin-exec__alert sev-${a.severity}`}>
                  <span className="admin-exec__sev">{execSeverityLabel(a.severity)}</span>
                  <span className="admin-exec__msg">
                    {a.message}
                    {a.recommendedAction ? <small>{a.recommendedAction}</small> : null}
                  </span>
                  {typeof a.count === 'number' ? <strong className="admin-exec__n">{a.count}</strong> : null}
                  <button type="button" className="admin-exec__go" onClick={() => onResolve(a)}>
                    Resolver →
                  </button>
                </li>
              ))}
            </ol>
          )}
          {pri.hidden ? <p className="admin-exec__more">+{pri.hidden} outro(s) nos detalhes abaixo</p> : null}
        </section>
        <div className="admin-exec__side">
          <section className="admin-exec__card" aria-labelledby="exec-act">
            <h3 id="exec-act" className="admin-exec__card-h">Ações rápidas</h3>
            <div className="admin-exec__actions">
              {actions.map((a) =>
                a.href ? (
                  <Link key={a.id} href={a.href} className="admin-exec__action">
                    <span>{a.label}</span>
                    {a.figure ? <b>{a.figure}</b> : null}
                  </Link>
                ) : (
                  <button key={a.id} type="button" className="admin-exec__action" onClick={a.onClick} title={a.hint}>
                    <span>{a.label}</span>
                    {a.figure ? <b>{a.figure}</b> : null}
                  </button>
                ),
              )}
            </div>
          </section>
          <section className="admin-exec__card" aria-labelledby="exec-health">
            <h3 id="exec-health" className="admin-exec__card-h">Saúde da loja</h3>
            <ul className="admin-exec__health">
              {health.map((h) => {
                const inner = (
                  <>
                    <span>{h.label}</span>
                    <b className={h.tone ? `is-${h.tone}` : ''}>{ready ? execHealthValue(h.value) : '—'}</b>
                  </>
                );
                return <li key={h.label}>{h.href ? <Link href={h.href}>{inner}</Link> : inner}</li>;
              })}
            </ul>
          </section>
        </div>
      </div>
    </section>
  );
}
