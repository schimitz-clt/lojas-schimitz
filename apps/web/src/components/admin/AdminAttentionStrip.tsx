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
};

function tone(sev: Severity): 'high' | 'warn' {
  return sev === 'critical' || sev === 'high' ? 'high' : 'warn';
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
}: Props): ReactNode {
  const visible = items.slice(0, max);

  if (variant === 'command') {
    const pending = snapshot === 'pending' && visible.length === 0;
    const unavailable = snapshot === 'error' && visible.length === 0;
    const empty = snapshot === 'ready' && visible.length === 0;
    return (
      <section className="admin-attn admin-attn--command" aria-labelledby="admin-attention-heading">
        <div className="admin-attn__head">
          <h2 id="admin-attention-heading" className="admin-attn__title">
            {OPS_ATTENTION_HEADING}
          </h2>
        </div>
        <p className="admin-attn__lede">
          Condições reais de GET /admin/ops. O atalho de cada alerta continua o mesmo. Nada aqui é
          estimado.
        </p>
        {pending ? (
          <div className="admin-shell-state admin-shell-state--loading" role="status">
            <p className="admin-shell-state__title">Lendo o snapshot…</p>
            <p>Os alertas aparecem quando o centro de comando responder.</p>
          </div>
        ) : null}
        {unavailable ? (
          <div className="admin-shell-state" role="status">
            <p className="admin-shell-state__title">Snapshot indisponível</p>
            <p>{opsAttentionUnavailableMessage()}</p>
          </div>
        ) : null}
        {empty ? (
          <div className="admin-shell-state admin-shell-state--empty" role="status">
            <p className="admin-shell-state__title">Nada em aberto</p>
            <p>{opsAttentionEmptyMessage(infoCount)}</p>
          </div>
        ) : null}
        {visible.length > 0 ? <AttentionList items={visible} onSelect={onSelect} /> : null}
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
