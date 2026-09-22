'use client';

import type { ReactNode } from 'react';
import {
  OPS_ATTENTION_HEADING,
  opsAlertSeverityLabelPt,
  opsAttentionEmptyMessage,
  opsAttentionUnavailableMessage,
} from '@/lib/admin-ops-ui';

type Severity = 'critical' | 'high' | 'warn' | 'info' | string;

export type AdminAttentionItem = {
  code: string;
  severity: Severity;
  message: string;
  /** Alert count from the snapshot. Null when the payload omitted it. */
  count?: number | null;
  recommendedAction?: string | null;
  evidenceLine?: string | null;
  ctaHint?: string | null;
};

type SnapshotState = 'pending' | 'ready' | 'error';

type Props = {
  items: AdminAttentionItem[];
  onSelect: (code: string) => void;
  max?: number;
  /** `command` is the Ops home question. Other sections keep the compact strip. */
  variant?: 'strip' | 'command';
  snapshot?: SnapshotState;
  /** Info-level alerts already on the snapshot and not listed in `items`. */
  infoCount?: number;
  /** Info-level alerts to list under the priority queue. Command variant only. */
  signals?: AdminAttentionItem[];
  /** Optional copy for sections whose evidence is their own list, not GET /admin/ops. */
  lede?: string;
  emptyMessage?: string;
  pendingTitle?: string;
  pendingBody?: string;
  unavailableTitle?: string;
  unavailableBody?: string;
};

function tone(sev: Severity): 'high' | 'warn' {
  return sev === 'critical' || sev === 'high' ? 'high' : 'warn';
}

function commandTone(sev: Severity): 'high' | 'warn' | 'info' {
  if (sev === 'critical' || sev === 'high') return 'high';
  if (sev === 'info') return 'info';
  return 'warn';
}

function CommandCard({
  item,
  onSelect,
}: {
  item: AdminAttentionItem;
  onSelect: (code: string) => void;
}) {
  const t = commandTone(item.severity);
  const actionable = Boolean(item.ctaHint);
  const countLabel = item.count == null || !Number.isFinite(Number(item.count)) ? '—' : String(item.count);
  const body = (
    <>
      <span className="admin-cc-alert__top">
        <span className="admin-cc-alert__sev">{opsAlertSeverityLabelPt(item.severity)}</span>
        <span className="admin-cc-alert__count">
          {countLabel}
          <span className="admin-cc-alert__count-label">contagem</span>
        </span>
      </span>
      <span className="admin-cc-alert__problem">{item.message}</span>
      {item.evidenceLine ? <span className="admin-cc-alert__meta">{item.evidenceLine}</span> : null}
      <span className="admin-cc-alert__paths">
        <span className="admin-cc-alert__path">
          <span className="admin-cc-alert__k">Abrir</span>
          {item.ctaHint || 'Sem atalho neste console'}
        </span>
        <span className="admin-cc-alert__path">
          <span className="admin-cc-alert__k">Resolver</span>
          {item.recommendedAction || '—'}
        </span>
      </span>
    </>
  );
  if (!actionable) {
    return <div className={`admin-cc-alert admin-cc-alert--${t} admin-cc-alert--static`}>{body}</div>;
  }
  return (
    <button type="button" className={`admin-cc-alert admin-cc-alert--${t}`} onClick={() => onSelect(item.code)}>
      {body}
    </button>
  );
}

function AttentionList({
  items,
  onSelect,
}: {
  items: AdminAttentionItem[];
  onSelect: (code: string) => void;
}) {
  return (
    <ul className="admin-attn__list">
      {items.map((a) => {
        const t = tone(a.severity);
        return (
          <li key={`attn-${a.code}`}>
            <button
              type="button"
              className={`admin-attn__btn admin-attn__btn--${t}`}
              onClick={() => onSelect(a.code)}
            >
              <span className="admin-attn__sev">{opsAlertSeverityLabelPt(a.severity)}</span>
              <span className="admin-attn__msg">
                {a.message}
                {a.ctaHint ? <span className="admin-attn__cta">{a.ctaHint}</span> : null}
              </span>
              {a.evidenceLine ? <span className="admin-attn__meta">{a.evidenceLine}</span> : null}
              {a.recommendedAction ? (
                <span className="admin-attn__meta">Ação: {a.recommendedAction}</span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function AdminAttentionStrip({
  items,
  onSelect,
  max = 6,
  variant = 'strip',
  snapshot = 'ready',
  infoCount = 0,
  signals = [],
  lede,
  emptyMessage,
  pendingTitle,
  pendingBody,
  unavailableTitle,
  unavailableBody,
}: Props): ReactNode {
  const visible = items.slice(0, max);
  const visibleSignals = signals.slice(0, 12);

  if (variant === 'command') {
    const pending = snapshot === 'pending' && visible.length === 0;
    const unavailable = snapshot === 'error' && visible.length === 0;
    const empty = snapshot === 'ready' && visible.length === 0;
    return (
      <section className="admin-attn admin-attn--command admin-cc-block" aria-labelledby="admin-attention-heading">
        <p className="admin-cc-block__step">02</p>
        <div className="admin-attn__head">
          <h2 id="admin-attention-heading" className="admin-attn__title">
            {OPS_ATTENTION_HEADING}
          </h2>
        </div>
        <p className="admin-attn__lede">
          {lede ||
            'Cada alerta do snapshot: o problema, onde abrir e como resolver. Os atalhos são os que já existem. Nada é estimado e nada se resolve sozinho.'}
        </p>
        {pending ? (
          <div className="admin-shell-state admin-shell-state--loading" role="status">
            <p className="admin-shell-state__title">{pendingTitle || 'Lendo o snapshot…'}</p>
            <p>{pendingBody || 'Os alertas aparecem quando o centro de comando responder.'}</p>
          </div>
        ) : null}
        {unavailable ? (
          <div className="admin-shell-state" role="status">
            <p className="admin-shell-state__title">{unavailableTitle || 'Snapshot indisponível'}</p>
            <p>{unavailableBody || opsAttentionUnavailableMessage()}</p>
          </div>
        ) : null}
        {empty ? (
          <div className="admin-shell-state admin-shell-state--empty" role="status">
            <p className="admin-shell-state__title">Nada em aberto</p>
            <p>{emptyMessage || opsAttentionEmptyMessage(infoCount)}</p>
          </div>
        ) : null}
        {visible.length > 0 ? (
          <ol className="admin-cc-alert-list">
            {visible.map((a) => (
              <li key={`attn-${a.code}`}>
                <CommandCard item={a} onSelect={onSelect} />
              </li>
            ))}
          </ol>
        ) : null}
        {visibleSignals.length > 0 ? (
          <div className="admin-cc-signals">
            <h3 className="admin-cc-signals__title">Sinais informativos</h3>
            <ol className="admin-cc-alert-list">
              {visibleSignals.map((a) => (
                <li key={`signal-${a.code}`}>
                  <CommandCard item={a} onSelect={onSelect} />
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </section>
    );
  }

  if (!visible.length) return null;

  const recon = visible.find((a) => a.code === 'open_reconciliations');
  return (
    <div className="admin-attn">
      <div className="admin-attn__head">
        <strong className="admin-attn__title">ATENÇÃO AGORA</strong>
        <span className="admin-attn__note">
          Revisar · sem execução automática
          {recon ? ` · ${recon.message.split(' — ')[0] || 'reconciliações abertas'}` : ''}
        </span>
      </div>
      <AttentionList items={visible} onSelect={onSelect} />
    </div>
  );
}
