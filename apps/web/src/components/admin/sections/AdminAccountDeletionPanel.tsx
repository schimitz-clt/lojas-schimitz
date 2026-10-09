'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, brl } from '@/lib/api';
import { formatAdminDateTime } from '@/lib/admin-customers-ui';
import {
  ADMIN_ACCOUNT_DELETION_API,
  ADMIN_ACCOUNT_DELETION_CONFIRM,
  ADMIN_ACCOUNT_DELETION_LEDE,
  ADMIN_ACCOUNT_DELETION_ON_BEHALF_LABEL,
  adminAccountDeletionProcessPath,
  type AdminAccountDeletionRequest,
} from '@/lib/admin-account-deletion-ui';

export function AdminAccountDeletionPanel() {
  const [rows, setRows] = useState<AdminAccountDeletionRequest[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [email, setEmail] = useState('');
  const [opening, setOpening] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await api<AdminAccountDeletionRequest[]>(ADMIN_ACCOUNT_DELETION_API));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Falha ao carregar pedidos de exclusão.');
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function openOnBehalf(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setOpening(true);
    setMsg('');
    try {
      await api(ADMIN_ACCOUNT_DELETION_API, {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), reason: 'Pedido recebido pelo WhatsApp' }),
      });
      setEmail('');
      setMsg('Pedido aberto. Confira a lista abaixo.');
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Falha ao abrir o pedido.');
    } finally {
      setOpening(false);
    }
  }

  async function processRow(r: AdminAccountDeletionRequest) {
    if (!window.confirm(ADMIN_ACCOUNT_DELETION_CONFIRM(r.email))) return;
    setBusy(r.userId);
    setMsg('');
    try {
      await api(adminAccountDeletionProcessPath(r.userId), { method: 'POST' });
      setMsg('Conta anonimizada. Pedidos e pagamentos foram mantidos.');
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Falha ao processar.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="admin-section-panel admin-crm-panel" id="admin-clientes-exclusao">
      <p className="admin-ent-kicker">LGPD</p>
      <h2 className="admin-cc-block__title">Pedidos de exclusão de conta</h2>
      <p className="admin-cc-block__lede">{ADMIN_ACCOUNT_DELETION_LEDE}</p>
      <form className="admin-toolbar__row" onSubmit={(e) => void openOnBehalf(e)}>
        <label className="admin-search-field" style={{ flex: 1, minWidth: 200, maxWidth: 'none' }}>
          <span>{ADMIN_ACCOUNT_DELETION_ON_BEHALF_LABEL}</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@exemplo.com" />
        </label>
        <button className="btn ghost admin-btn-ghost-pro" type="submit" disabled={opening || !email.trim()}>
          {opening ? 'Abrindo…' : 'Abrir pedido'}
        </button>
      </form>
      {msg ? <p className="admin-ent-note">{msg}</p> : null}
      <div className="admin-dense-list">
        {rows === null ? <p className="admin-empty">Carregando…</p> : null}
        {rows && !rows.length ? <p className="admin-empty">Nenhum pedido pendente.</p> : null}
        {(rows || []).map((r) => (
          <div key={r.userId} className="admin-dense-row">
            <div className="admin-dense-row__main">
              <div className="admin-dense-row__title">
                <b>{r.name}</b>
              </div>
              <div className="admin-dense-row__meta">
                {r.email} · pedido em {formatAdminDateTime(r.requestedAt)}
                {r.cashbackBalance > 0 ? ` · cashback ${brl(r.cashbackBalance)} será perdido` : ''}
              </div>
              {r.reason ? <div className="admin-dense-row__meta">Motivo: {r.reason}</div> : null}
              {r.blockerMessage ? <div className="admin-dense-row__meta">⚠ {r.blockerMessage}</div> : null}
            </div>
            <button
              className="btn admin-btn-primary-accent"
              type="button"
              disabled={Boolean(r.blocker) || busy === r.userId}
              onClick={() => void processRow(r)}
            >
              {busy === r.userId ? 'Processando…' : 'Excluir dados'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
