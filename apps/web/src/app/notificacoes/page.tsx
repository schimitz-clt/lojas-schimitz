'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, currentUser } from '@/lib/api';

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  linkUrl?: string | null;
  readAt?: string | null;
  createdAt: string;
};

function formatTs(iso: string) {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function NotificacoesPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const data = await api<{ items: Notification[]; unreadCount: number }>('/notifications');
    setItems(data.items || []);
    setUnreadCount(data.unreadCount || 0);
  }, []);

  useEffect(() => {
    const u = currentUser();
    if (!u) {
      window.location.href = '/entrar';
      return;
    }
    load().catch((e) => setErr(e.message || 'Falha ao carregar notificações'));
  }, [load]);

  async function markOne(id: string) {
    setBusy(true);
    setErr('');
    try {
      await api(`/notifications/${id}/read`, { method: 'POST' });
      await load();
    } catch (e: any) {
      setErr(e.message || 'Falha ao marcar como lida');
    } finally {
      setBusy(false);
    }
  }

  async function markAll() {
    setBusy(true);
    setErr('');
    try {
      await api('/notifications/read-all', { method: 'POST' });
      await load();
    } catch (e: any) {
      setErr(e.message || 'Falha ao marcar todas');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: '24px 0' }}>
      <div className="row" style={{ alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Notificações</h1>
        {unreadCount > 0 ? (
          <button className="btn ghost" disabled={busy} onClick={markAll}>
            Marcar todas como lidas ({unreadCount})
          </button>
        ) : null}
      </div>
      <p className="muted">
        Acompanhe pagamentos e status dos pedidos. <Link href="/pedidos">Meus pedidos</Link>
      </p>
      {err ? <div className="alert">{err}</div> : null}
      {!items.length ? <p className="muted">Nenhuma notificação ainda.</p> : null}
      {items.map((n) => {
        const unread = !n.readAt;
        const inner = (
          <div className="body">
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <b style={{ fontWeight: unread ? 800 : 600 }}>{n.title}</b>
                <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  {formatTs(n.createdAt)}
                  {unread ? ' · não lida' : ''}
                </div>
                {n.body ? <p style={{ marginBottom: 0 }}>{n.body}</p> : null}
              </div>
              {unread ? (
                <button
                  type="button"
                  className="btn ghost"
                  disabled={busy}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void markOne(n.id);
                  }}
                >
                  Marcar lida
                </button>
              ) : null}
            </div>
          </div>
        );
        return (
          <div
            key={n.id}
            className="card"
            style={{
              marginBottom: 10,
              borderColor: unread ? 'var(--ok)' : undefined,
              opacity: unread ? 1 : 0.85,
            }}
          >
            {n.linkUrl ? (
              <Link href={n.linkUrl} style={{ textDecoration: 'none', color: 'inherit' }} onClick={() => { if (unread) void markOne(n.id); }}>
                {inner}
              </Link>
            ) : (
              inner
            )}
          </div>
        );
      })}
    </div>
  );
}
