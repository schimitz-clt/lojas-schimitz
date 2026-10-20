'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatBrlCurrency } from '@/lib/money-format';
import { formatAdminDate } from '@/lib/admin-customers-ui';
import { orderStatusLabel } from '@/lib/order-status';
import { AdminStatusChip } from '@/components/admin/AdminStatusChip';
import {
  STALLED_EMPTY_TITLE,
  countStalledByReason,
  formatStalledAge,
  stalledOrderHref,
  stalledReasonHint,
  stalledReasonLabel,
  stalledReasonTone,
  stalledRulesLede,
  type StalledOrdersPayload,
} from '@/lib/admin-stalled-orders';

type Load = 'pending' | 'ready' | 'error';

export function AdminParadosSection() {
  const [load, setLoad] = useState<Load>('pending');
  const [data, setData] = useState<StalledOrdersPayload | null>(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoad('pending');
    setError('');
    try {
      const d = await api<StalledOrdersPayload>('/admin/ops/stalled-orders');
      setData(d);
      setLoad('ready');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao ler os pedidos parados.');
      setLoad('error');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const items = load === 'ready' && data ? data.items : [];
  const counts = countStalledByReason(items);

  return (
    <div className="admin-section-panel" id="admin-parados" data-testid="admin-parados">
      <p className="admin-ent-kicker">Operação</p>
      <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <h2 className="admin-cc-block__title">Pedidos parados</h2>
        <button type="button" className="btn ghost admin-btn-ghost-pro" onClick={() => void refresh()} disabled={load === 'pending'}>
          {load === 'pending' ? 'Atualizando…' : 'Atualizar'}
        </button>
      </div>
      <p className="admin-cc-block__lede">
        {data ? stalledRulesLede(data) : 'Pedidos que precisam de ação: pagos sem organizar, separação parada ou enviados sem rastreio.'}
      </p>

      {load === 'error' ? (
        <div className="alert" role="alert">
          Não foi possível ler os pedidos parados. Nenhum número foi estimado. {error}
        </div>
      ) : null}

      {load === 'pending' && !data ? <p className="admin-ent-note">Lendo pedidos…</p> : null}

      {load === 'ready' && data ? (
        <>
          <p className="admin-ent-note" data-testid="admin-parados-summary">
            {data.count} parado(s): {counts.paid_awaiting_org} pago(s) sem organizar · {counts.prep_stuck} em separação parada ·{' '}
            {counts.shipped_no_tracking} enviado(s) sem rastreio. Atualizado {formatAdminDate(data.generatedAt)}.
          </p>
          {items.length === 0 ? (
            <div className="ok" data-testid="admin-parados-empty">
              {STALLED_EMPTY_TITLE} Quando algum pedido passar do prazo, ele aparece aqui.
            </div>
          ) : (
            <div className="admin-dense-list" data-testid="admin-parados-list">
              {items.map((o) => (
                <div key={o.id} className="admin-dense-row">
                  <div className="admin-dense-row__main">
                    <div className="admin-dense-row__title">
                      <Link href={stalledOrderHref(o)}>
                        <b>Pedido {o.publicId}</b>
                      </Link>
                      <AdminStatusChip label={stalledReasonLabel(o.reason)} tone={stalledReasonTone(o.reason)} />
                    </div>
                    <div className="admin-dense-row__meta" style={{ marginTop: 4 }}>
                      {orderStatusLabel(o.status)} há {formatStalledAge(o.ageHours)}
                      {o.customerName ? ` · ${o.customerName}` : ''}
                      {o.total != null ? ` · ${formatBrlCurrency(o.total)}` : ''}
                    </div>
                    <div className="admin-dense-row__meta">{stalledReasonHint(o.reason)}</div>
                  </div>
                  <div className="admin-dense-row__actions">
                    <Link className="btn ghost admin-btn-ghost-pro" href={stalledOrderHref(o)}>
                      Abrir pedido
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
