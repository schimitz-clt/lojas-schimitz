'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, currentUser, userAccountLabel, waLink } from '@/lib/api';

export function Header() {
  const [user, setUser] = useState<ReturnType<typeof currentUser>>(null);
  const [q, setQ] = useState('');
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const u = currentUser();
    setUser(u);
    if (!u) return;
    api<{ unreadCount: number }>('/notifications?limit=1')
      .then((d) => setUnread(d.unreadCount || 0))
      .catch(() => setUnread(0));
  }, []);

  return (
    <>
      <div className="topbar">LOJAS SCHIMITZ · OFERTAS TODO DIA · 12x · 5% OFF NO PIX · FRETE GRÁTIS EM PORTO ALEGRE</div>
      <header className="header">
        <div className="wrap">
          <div className="header-row">
            <Link href="/" className="logo">LOJAS <span>SCHIMITZ</span></Link>
            <form className="search" action="/" onSubmit={(e) => { e.preventDefault(); window.location.href = `/?q=${encodeURIComponent(q)}`; }}>
              <input placeholder="Buscar TVs, celulares, notebooks..." value={q} onChange={(e) => setQ(e.target.value)} />
            </form>
            <div className="actions">
              {user ? (
                <Link className="btn ghost" href="/notificacoes" title="Notificações">
                  🔔{unread > 0 ? ` ${unread}` : ''}
                </Link>
              ) : null}
              <Link className="btn ghost" href="/favoritos">Favoritos</Link>
              <Link className="btn ghost" href="/carrinho">Sacola</Link>
              <Link className="btn ghost" href={user ? '/conta' : '/entrar'}>{user ? userAccountLabel(user) : 'Entrar'}</Link>
              <a className="btn wa" href={waLink()} target="_blank" rel="noreferrer">WhatsApp</a>
            </div>
          </div>
          <nav className="nav">
            <Link href="/produtos">Produtos</Link>
            <Link href="/departamento/eletro">Eletro</Link>
            <Link href="/departamento/celulares">Celulares</Link>
            <Link href="/departamento/informatica">Informática</Link>
            <Link href="/departamento/eletrodomesticos">Eletrodomésticos</Link>
            <Link href="/departamento/casa">Casa</Link>
            <Link href="/departamento/esporte">Esporte</Link>
            <Link href="/departamento/ofertas">Ofertas</Link>
            <Link href="/suporte">Suporte</Link>
          </nav>
        </div>
      </header>
      <nav className="tabbar">
        <Link href="/">Início</Link>
        <Link href="/departamento/ofertas">Depart.</Link>
        <Link href="/carrinho">Carrinho</Link>
        <Link href={user ? '/notificacoes' : '/entrar'}>Avisos{unread > 0 ? ` (${unread})` : ''}</Link>
        <Link href={user ? '/conta' : '/entrar'}>Conta</Link>
      </nav>
    </>
  );
}
