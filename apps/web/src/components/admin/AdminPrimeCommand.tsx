'use client';

import Link from 'next/link';
import { OPS_DO_HEADING, OPS_NOW_HEADING } from '@/lib/admin-ops-ui';
import { buildAdminSectionHref } from '@/lib/admin-sections';
import type { PrimeAction, PrimeAttentionItem, PrimeKpi, PrimeLoad } from '@/lib/admin-prime-sections-ui';
import { AdminAttentionStrip } from '@/components/admin/AdminAttentionStrip';

export function scrollAdminAnchor(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const LIST_LEDE =
  'Cada item sai do payload já carregado: o problema, onde abrir e como resolver. Nada é estimado e nada se resolve sozinho.';

function toAttentionItem(item: PrimeAttentionItem) {
  return {
    code: item.code,
    severity: item.severity,
    message: item.message,
    count: item.count,
    recommendedAction: item.recommendedAction,
    evidenceLine: item.evidenceLine,
    ctaHint: item.ctaHint,
  };
}

export function AdminPrimeCommand({
  eyebrow,
  title,
  endpoint,
  busy,
  onRefresh,
  nowLede,
  summary,
  kpis,
  onKpi,
  load,
  attention,
  signals,
  onAttention,
  doLede,
  actions,
  onAction,
  emptyMessage,
}: {
  eyebrow: string;
  title: string;
  endpoint: string;
  busy: boolean;
  onRefresh: () => void;
  nowLede: string;
  summary: string;
  kpis: PrimeKpi[];
  onKpi?: (id: string) => void;
  load: PrimeLoad;
  attention: PrimeAttentionItem[];
  signals: PrimeAttentionItem[];
  onAttention: (code: string) => void;
  doLede: string;
  actions: PrimeAction[];
  onAction?: (id: string) => void;
  emptyMessage?: string;
}) {
  const nowId = `${eyebrow.toLowerCase()}-now-heading`;
  const doId = `${eyebrow.toLowerCase()}-do-heading`;
  return (
    <div className="admin-section-panel admin-cc">
      <header className="admin-cc-banner">
        <div>
          <p className="admin-cc-banner__eyebrow">{eyebrow}</p>
          <p className="admin-cc-banner__title">{title}</p>
          <p className="admin-cc-banner__meta">{endpoint}</p>
        </div>
        <button type="button" className="admin-cc-banner__refresh" disabled={busy} onClick={onRefresh}>
          {busy ? 'Atualizando…' : 'Atualizar'}
        </button>
      </header>

      <section className="admin-cc-block" aria-labelledby={nowId}>
        <p className="admin-cc-block__step">01</p>
        <h2 id={nowId} className="admin-cc-block__title">
          {OPS_NOW_HEADING}
        </h2>
        <p className="admin-cc-block__lede">{nowLede}</p>
        <p className="admin-cc-nowline" role="status">
          {summary}
        </p>
        <div className="admin-cc-kpi-grid">
          {kpis.map((kpi) => (
            <button
              key={kpi.id}
              type="button"
              className={`admin-cc-kpi${kpi.tone === 'danger' ? ' admin-cc-kpi--danger' : ''}${kpi.tone === 'warn' ? ' admin-cc-kpi--warn' : ''}`}
              onClick={() => onKpi?.(kpi.id)}
            >
              <div className="admin-cc-kpi__label">{kpi.label}</div>
              <div className={`admin-cc-kpi__value${kpi.tone === 'danger' ? ' admin-cc-kpi__value--danger' : ''}`}>
                {kpi.value}
              </div>
              <div className="admin-cc-kpi__hint">{kpi.hint}</div>
            </button>
          ))}
        </div>
      </section>

      <AdminAttentionStrip
        variant="command"
        snapshot={load}
        lede={LIST_LEDE}
        emptyMessage={
          emptyMessage ||
          (signals.length
            ? 'Nenhum alerta prioritário nesta lista. Sinais informativos continuam abaixo.'
            : 'Nada precisa de atenção nesta lista.')
        }
        pendingTitle="Lendo a lista…"
        pendingBody="Os alertas aparecem quando o endpoint responder. Nenhum número foi estimado."
        unavailableTitle="Lista indisponível"
        unavailableBody="Nenhum número foi estimado."
        infoCount={signals.length}
        max={Math.max(attention.length, 1)}
        items={attention.map(toAttentionItem)}
        signals={signals.map(toAttentionItem)}
        onSelect={onAttention}
      />

      <section className="admin-cc-block" aria-labelledby={doId}>
        <p className="admin-cc-block__step">03</p>
        <h2 id={doId} className="admin-cc-block__title">
          {OPS_DO_HEADING}
        </h2>
        <p className="admin-cc-block__lede">{doLede}</p>
        <div className="admin-cc-actions admin-cc-actions--sticky">
          {actions.map((action) => {
            if (action.id === 'pedidos') {
              return (
                <Link key={action.id} className="admin-cc-action" href={buildAdminSectionHref('pedidos')}>
                  <span className="admin-cc-action__label">{action.label}</span>
                  <span className="admin-cc-action__hint">{action.hint}</span>
                </Link>
              );
            }
            return (
              <button key={action.id} type="button" className="admin-cc-action" onClick={() => onAction?.(action.id)}>
                <span className="admin-cc-action__label">{action.label}</span>
                <span className="admin-cc-action__hint">{action.hint}</span>
                {action.figure ? <span className="admin-cc-action__figure">{action.figure}</span> : null}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
