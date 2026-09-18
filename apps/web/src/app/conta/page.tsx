'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, brl, clearSession, waLink } from '@/lib/api';
import { AccountMenu } from '@/components/account/AccountMenu';
import {
  ACCOUNT_HUB_TITLE,
  ACCOUNT_WHATSAPP_HELP_TEXT,
  accountGreeting,
  accountLoginHref,
  accountMenuSections,
} from '@/lib/account-menu';
import { authRegisterHref } from '@/lib/checkout-auth';
import { useSessionUser } from '@/lib/use-session-user';
import { orderStatusLabel } from '@/lib/order-status';
import { orderRecoveryPaths } from '@/lib/order-recovery';
import { pickInProgressOrder } from '@/lib/pix-payment-ui';

type CustomerOrder = {
  id: string;
  publicId: string;
  status: string;
  total: number;
  payments?: { status: string; method: string }[];
};

export default function ContaPage() {
  const { user, ready } = useSessionUser();
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      setOrders([]);
      return;
    }
    api<CustomerOrder[]>('/orders')
      .then(setOrders)
      .catch(() => setOrders([]));
  }, [ready, user]);

  const greeting = !ready
    ? { title: 'Olá', subtitle: 'Carregando sua conta...' }
    : accountGreeting(user);
  const whatsappHref = waLink(ACCOUNT_WHATSAPP_HELP_TEXT);
  const sections = useMemo(
    () =>
      accountMenuSections({
        loggedIn: Boolean(user),
        role: user?.role,
        whatsappHref,
      }),
    [user, whatsappHref],
  );

  const activeOrder = user && orders ? pickInProgressOrder(orders) : null;
  const activePaths = activeOrder ? orderRecoveryPaths(activeOrder.publicId) : null;
  const activePay =
    activeOrder?.payments?.find((p) => p.status === 'approved') ||
    activeOrder?.payments?.find((p) => p.status === 'pending');

  function logout() {
    clearSession();
    window.location.href = '/';
  }

  return (
    <div className="account-hub">
      <header className="account-hub-head">
        <p className="account-hub-kicker">{ACCOUNT_HUB_TITLE}</p>
        <h1 className="account-hub-title">{greeting.title}</h1>
        <p className="account-hub-sub muted">{greeting.subtitle}</p>
        {ready && !user ? (
          <div className="account-hub-cta">
            <Link className="btn account-hub-enter" href={accountLoginHref('/conta')}>
              Entrar
            </Link>
            <Link className="btn ghost" href={authRegisterHref('/conta')}>
              Criar conta
            </Link>
          </div>
        ) : null}
      </header>

      {user ? (
        <section className="account-hub-progress" aria-labelledby="conta-pedido-andamento">
          <div className="account-hub-card account-hub-progress-card">
            <h2 id="conta-pedido-andamento" className="account-hub-progress-title">
              Pedido em andamento
            </h2>
            {orders === null ? (
              <p className="muted" style={{ marginBottom: 0 }}>
                Carregando pedidos...
              </p>
            ) : activeOrder && activePaths ? (
              <>
                <p style={{ margin: '4px 0' }}>
                  Código: <b>{activeOrder.publicId}</b>
                </p>
                <p className="muted" style={{ margin: 0, fontSize: 14 }}>
                  {orderStatusLabel(activeOrder.status)}
                  {activePay?.method === 'pix' && activePay.status === 'approved'
                    ? ' · PIX aprovado'
                    : activePay?.method === 'pix' && activePay.status === 'pending'
                      ? ' · Aguardando PIX'
                      : ''}
                  {' · '}
                  {brl(activeOrder.total)}
                </p>
                <div className="account-hub-cta" style={{ marginTop: 12, marginBottom: 0 }}>
                  <Link className="btn" href={activePaths.verMeuPedido}>
                    Acompanhar
                  </Link>
                  <Link className="btn ghost" href={activePaths.meusPedidos}>
                    Meus pedidos
                  </Link>
                </div>
              </>
            ) : (
              <p className="muted" style={{ marginBottom: 0 }}>
                Nenhum pedido em andamento.{' '}
                <Link href="/pedidos">Ver meus pedidos</Link>
              </p>
            )}
          </div>
        </section>
      ) : null}

      <AccountMenu sections={sections} onLogout={logout} />
    </div>
  );
}
