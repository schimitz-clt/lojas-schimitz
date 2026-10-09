'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useSessionUser } from '@/lib/use-session-user';
import { accountLoginHref } from '@/lib/account-menu';
import {
  ACCOUNT_DELETION_API,
  ACCOUNT_DELETION_PATH,
  ACCOUNT_DELETION_REASON_MAX,
  accountDeletionStatusCopy,
  cleanDeletionReasonInput,
  type AccountDeletionStatus,
} from '@/lib/account-deletion';

const box = {
  border: '1px solid var(--line, #ddd)',
  borderRadius: 12,
  padding: 16,
  marginTop: 16,
} as const;

export default function AccountDeletionRequest() {
  const { user, ready } = useSessionUser();
  const [status, setStatus] = useState<AccountDeletionStatus | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    api<AccountDeletionStatus>(ACCOUNT_DELETION_API)
      .then(setStatus)
      .catch((e) => setError(e instanceof Error ? e.message : 'Não foi possível carregar o status.'));
  }, [user]);

  if (!ready) return null;
  if (!user) {
    return (
      <div style={box}>
        <p style={{ margin: 0 }}>
          Para pedir pelo site ou app, <Link href={accountLoginHref(ACCOUNT_DELETION_PATH)}>entre na sua conta</Link>.
        </p>
      </div>
    );
  }

  async function run(method: 'POST' | 'DELETE') {
    setBusy(true);
    setError('');
    try {
      const body = method === 'POST' ? JSON.stringify({ reason: cleanDeletionReasonInput(reason) }) : undefined;
      setStatus(await api<AccountDeletionStatus>(ACCOUNT_DELETION_API, { method, body }));
      setConfirm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível concluir. Tente de novo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={box} data-testid="account-deletion-request">
      <p style={{ marginTop: 0 }}>
        Conta: <strong>{user.email}</strong>
      </p>
      {status ? <p>{accountDeletionStatusCopy(status)}</p> : null}
      {status?.status === 'none' ? (
        <>
          <label style={{ display: 'block', marginBottom: 8 }}>
            Motivo (opcional)
            <textarea
              value={reason}
              maxLength={ACCOUNT_DELETION_REASON_MAX}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            />
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 12 }}>
            <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
            <span>Entendi que meus dados pessoais serão apagados e que não poderei mais entrar com esta conta.</span>
          </label>
          <button className="btn" type="button" disabled={!confirm || busy} onClick={() => run('POST')}>
            {busy ? 'Enviando…' : 'Pedir exclusão da conta'}
          </button>
        </>
      ) : null}
      {status?.status === 'pending' ? (
        <button className="btn ghost" type="button" disabled={busy} onClick={() => run('DELETE')}>
          {busy ? 'Enviando…' : 'Desistir da exclusão'}
        </button>
      ) : null}
      {error ? (
        <p role="alert" style={{ color: 'var(--danger, #b00020)' }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
