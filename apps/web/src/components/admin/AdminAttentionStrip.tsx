'use client';

import type { ReactNode } from 'react';
import { opsAlertSeverityLabelPt } from '@/lib/admin-ops-ui';

type Severity = 'critical' | 'high' | 'warn' | 'info' | string;

export type AdminAttentionItem = {
  code: string;
  severity: Severity;
  message: string;
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
  const recon = items.find((a) => a.code === 'open_reconciliations');
  return (
    <div className="admin-attn">
      <div className="admin-attn__head">
        <strong className="admin-attn__title">ATENÇÃO AGORA</strong>
        <span style={{ fontSize: 12, color: '#b0b0a8' }}>
          Revisar · sem execução automática
          {recon
            ? ` · ${recon.message.split(' — ')[0] || 'reconciliações abertas'}`
            : ''}
        </span>
      </div>
      <ul className="admin-attn__list">
        {items.slice(0, max).map((a) => {
          const t = tone(a.severity);
          return (
            <li key={`attn-${a.code}`}>
              <button
                type="button"
                className={`admin-attn__btn admin-attn__btn--${t}`}
                onClick={() => onSelect(a.code)}
              >
                <span style={{ fontSize: 11, textTransform: 'uppercase', marginRight: 8 }}>
                  {opsAlertSeverityLabelPt(a.severity)}
                </span>
                {a.message}
                {a.ctaHint ? ` ${a.ctaHint}` : ''}
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
