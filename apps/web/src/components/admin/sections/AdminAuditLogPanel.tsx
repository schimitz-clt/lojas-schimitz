'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatAdminDateTime } from '@/lib/admin-customers-ui';
import {
  ADMIN_AUDIT_ENTITY_OPTIONS,
  ADMIN_AUDIT_LOG_API,
  ADMIN_AUDIT_LOG_LEDE,
  ADMIN_AUDIT_LOG_PAGE,
  auditActionLabel,
  auditActorLabel,
  auditChangesSummary,
  auditLogQueryString,
  auditOutcomeLabel,
  type AdminAuditLogItem,
  type AdminAuditLogPage,
} from '@/lib/admin-audit-log-ui';

export function AdminAuditLogPanel() {
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [items, setItems] = useState<AdminAuditLogItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(
    async (skip: number) => {
      setLoading(true);
      setMsg('');
      try {
        const page = await api<AdminAuditLogPage>(
          `${ADMIN_AUDIT_LOG_API}?${auditLogQueryString({ entity, action, skip })}`,
        );
        setTotal(page.total);
        setItems((prev) => (skip > 0 && prev ? [...prev, ...page.items] : page.items));
      } catch (e) {
        setMsg(e instanceof Error ? e.message : 'Não foi possível carregar o registro de atividades.');
        setItems((prev) => prev ?? []);
      } finally {
        setLoading(false);
      }
    },
    [entity, action],
  );

  useEffect(() => {
    void load(0);
  }, [load]);

  return (
    <div className="admin-section-panel" id="admin-equipe-atividades">
      <p className="admin-ent-kicker">Auditoria</p>
      <h2 className="admin-cc-block__title">Registro de atividades</h2>
      <p className="admin-cc-block__lede">{ADMIN_AUDIT_LOG_LEDE}</p>
      <div className="admin-toolbar__row">
        <label className="admin-search-field" style={{ minWidth: 180 }}>
          <span>Área</span>
          <select value={entity} onChange={(e) => setEntity(e.target.value)}>
            {ADMIN_AUDIT_ENTITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-search-field" style={{ flex: 1, minWidth: 200, maxWidth: 'none' }}>
          <span>Buscar na ação (ex.: refund, products)</span>
          <input value={action} onChange={(e) => setAction(e.target.value)} placeholder="Digite parte do nome da ação" maxLength={80} />
        </label>
        <button className="btn ghost admin-btn-ghost-pro" type="button" disabled={loading} onClick={() => void load(0)}>
          {loading ? 'Carregando…' : 'Atualizar'}
        </button>
      </div>
      {msg ? <p className="admin-ent-note">{msg}</p> : null}
      <div className="admin-dense-list">
        {items === null ? <p className="admin-empty">Carregando…</p> : null}
        {items && !items.length && !msg ? <p className="admin-empty">Nenhuma atividade encontrada para este filtro.</p> : null}
        {(items || []).map((it) => {
          const changes = auditChangesSummary(it.meta);
          const outcome = auditOutcomeLabel(it.meta);
          return (
            <div key={it.id} className="admin-dense-row">
              <div className="admin-dense-row__main">
                <div className="admin-dense-row__title">
                  <b>{auditActionLabel(it.action)}</b>
                  {outcome ? <span className="admin-dense-row__meta"> · {outcome}</span> : null}
                </div>
                <div className="admin-dense-row__meta">
                  {auditActorLabel(it.actor)} · {formatAdminDateTime(it.createdAt)}
                  {it.entityId ? ` · ${it.entity || 'item'} ${it.entityId.slice(0, 8)}` : ''}
                </div>
                {changes ? <div className="admin-dense-row__meta">{changes}</div> : null}
              </div>
            </div>
          );
        })}
      </div>
      {items && items.length < total ? (
        <button
          className="btn ghost admin-btn-ghost-pro"
          type="button"
          disabled={loading}
          onClick={() => void load(items.length)}
        >
          {loading ? 'Carregando…' : `Ver mais (${items.length} de ${total})`}
        </button>
      ) : null}
      <p className="admin-ent-note">Mostrando de {ADMIN_AUDIT_LOG_PAGE} em {ADMIN_AUDIT_LOG_PAGE}, mais recentes primeiro.</p>
    </div>
  );
}
