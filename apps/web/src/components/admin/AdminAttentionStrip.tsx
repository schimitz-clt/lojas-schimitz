'use client';

import type { ReactNode } from 'react';
import { opsAlertCodeLabelPt, opsAlertSeverityLabelPt } from '@/lib/admin-ops-ui';

type Severity = 'critical' | 'high' | 'warn' | 'info' | string;

export type AdminAttentionItem = {
  code: string;
  label?: string | null;
  severity: Severity;
  message: string;
  count?: number;
  recommendedAction?: string | null;
  evidenceLine?: string | null;
  ctaHint?: string | null;
};

type Props = {
  items: AdminAttentionItem[];
  onSelect: (code: string) => void;
  max?: number;
};

function tone(sev: Severity): 'high' | 'warn' {
  return sev === 'critical' || sev === 'high' ? 'high' : 'warn';
}

export function AdminAttentionStrip({ items, onSelect, max = 6 }: Props): ReactNode {
  if (!items.length) return null;
  return (
    <div className="admin-attn">
      <div className="admin-attn__head">
        <strong className="admin-attn__title">Atenção agora</strong>
        <span style={{ fontSize: 12, color: '#b0b0a8' }}>Revisar · sem execução automática</span>
      </div>
      <ul className="admin-attn__list">
        {items.slice(0, max).map((a) => {
          const t = tone(a.severity);
          const label = opsAlertCodeLabelPt(a.code, a.label);
          const sevPt = opsAlertSeverityLabelPt(a.severity);
          return (
            <li key={`attn-${a.code}`}>
              <button
                type="button"
                className={`admin-attn__btn admin-attn__btn--${t}`}
                onClick={() => onSelect(a.code)}
              >
                <span style={{ fontSize: 11, marginRight: 8, fontWeight: 700 }}>
                  {sevPt}
                  {typeof a.count === 'number' && a.count > 0 ? ` · ${a.count}` : ''}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{label}</span>
                <span style={{ display: 'block', marginTop: 4 }}>{a.message}</span>
                <span style={{ display: 'block', fontSize: 11, opacity: 0.7, marginTop: 2 }}>
                  código {a.code}
                  {a.ctaHint ? ` · ${a.ctaHint}` : ''}
                </span>
                {a.evidenceLine ? (
                  <span style={{ display: 'block', fontSize: 11, opacity: 0.85, marginTop: 4 }}>
                    {a.evidenceLine}
                  </span>
                ) : null}
                {a.recommendedAction ? (
                  <span style={{ display: 'block', fontSize: 11, opacity: 0.8, marginTop: 2 }}>
                    Ação: {a.recommendedAction}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
