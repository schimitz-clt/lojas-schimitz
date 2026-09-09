'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, currentUser, userAccountLabel, waLink } from '@/lib/api';

const CEP_KEY = 'sch_cep';

function formatCep(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function Header() {
  const [user, setUser] = useState<ReturnType<typeof currentUser>>(null);
  const [q, setQ] = useState('');
  const [unread, setUnread] = useState(0);
  const [cartCount, setCartCount] = useState(0);
  const [cep, setCep] = useState('');
  const [editingCep, setEditingCep] = useState(false);
  const [cepDraft, setCepDraft] = useState('');

  useEffect(() => {
    const u = currentUser();
    setUser(u);
    try {
      const saved = localStorage.getItem(CEP_KEY) || '';
      setCep(saved);
      setCepDraft(saved);
    } catch {
      /* ignore */
    }
    if (u) {
      api<{ unreadCount: number }>('/notifications?limit=1')
        .then((d) => setUnread(d.unreadCount || 0))
        .catch(() => setUnread(0));
    }
    api<{ itemCount?: number }>('/cart')
      .then((d) => setCartCount(d.itemCount || 0))
      .catch(() => setCartCount(0));
    const onCart = () => {
      api<{ itemCount?: number }>('/cart')
        .then((d) => setCartCount(d.itemCount || 0))
        .catch(() => {});
    };
    window.addEventListener('sch-cart-updated', onCart);
    return () => window.removeEventListener('sch-cart-updated', onCart);
  }, []);

  function saveCep(e?: { preventDefault(): void }) {
    e?.preventDefault();
    const next = formatCep(cepDraft);
    const digits = next.replace(/\D/g, '');
    if (digits.length !== 8) return;
    setCep(next);
    setCepDraft(next);
    try {
      localStorage.setItem(CEP_KEY, next);
    } catch {
      /* ignore */
    }
    setEditingCep(false);
  }

  return (
    <>
      <div className="topbar">
        LOJAS SCHIMITZ · OFERTAS TODO DIA · 12x · 5% OFF NO PIX · FRETE GRÁTIS EM PORTO ALEGRE
      </div>
      <header className="header">
        <div className="wrap">
          <div className="header-row">
            <Link href="/" className="logo" aria-label="Lojas Schimitz — início">
              LOJAS <span>SCHIMITZ</span>
            </Link>

            <form
              className="search"
              action="/produtos"
              onSubmit={(e) => {
                e.preventDefault();
                const term = q.trim();
                window.location.href = term
                  ? `/produtos?q=${encodeURIComponent(term)}`
                  : '/produtos';
              }}
            >
              <input
                name="q"
                placeholder="O que você está procurando?"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Buscar produtos"
              />
              <button type="submit" className="search-submit" aria-label="Buscar">
                🔍
              </button>
            </form>

            {editingCep ? (
              <form className="hdr-cep-form" onSubmit={saveCep}>
                <input
                  inputMode="numeric"
                  placeholder="00000-000"
                  value={cepDraft}
                  onChange={(e) => setCepDraft(formatCep(e.target.value))}
                  aria-label="Informe seu CEP"
                  autoFocus
                />
                <button type="submit">OK</button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingCep(false);
                    setCepDraft(cep);
                  }}
                >
                  ✕
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="hdr-cep hdr-hide-sm"
                onClick={() => setEditingCep(true)}
                aria-label="Informar CEP para frete"
              >
                <span style={{ color: 'rgba(255,255,255,.75)', fontSize: 11 }}>
                  Informe seu CEP
                </span>
                <strong>{cep || 'Calcular frete'}</strong>
              </button>
            )}

            <div className="actions">
              <Link className="hdr-link" href={user ? '/conta' : '/entrar'}>
                <span className="hdr-link-ico" aria-hidden>
                  👤
                </span>
                {user ? userAccountLabel(user) : 'Entrar'}
              </Link>
              <Link className="hdr-link hdr-hide-sm" href="/favoritos">
                <span className="hdr-link-ico" aria-hidden>
                  ♥
                </span>
                Favoritos
              </Link>
              <Link className="hdr-link" href="/carrinho">
                <span className="hdr-link-ico" aria-hidden>
                  🛒
                </span>
                Carrinho
                {cartCount > 0 ? (
                  <span className="hdr-badge">{cartCount > 99 ? '99+' : cartCount}</span>
                ) : null}
              </Link>
              {user ? (
                <Link className="hdr-link hdr-hide-sm" href="/notificacoes" title="Notificações">
                  <span className="hdr-link-ico" aria-hidden>
                    🔔
                  </span>
                  Avisos
                  {unread > 0 ? (
                    <span className="hdr-badge">{unread > 99 ? '99+' : unread}</span>
                  ) : null}
                </Link>
              ) : null}
              <a className="btn wa hdr-hide-sm" href={waLink()} target="_blank" rel="noreferrer">
                WhatsApp
              </a>
            </div>
          </div>
        </div>
        <div className="nav-depts">
          <div className="wrap">
            <nav className="nav" aria-label="Departamentos">
              <Link href="/produtos" className="nav-hot">
                Todas as categorias
              </Link>
              <Link href="/departamento/ofertas">Ofertas</Link>
              <Link href="/departamento/celulares">Celulares</Link>
              <Link href="/departamento/eletrodomesticos">Eletrodomésticos</Link>
              <Link href="/departamento/informatica">Informática</Link>
              <Link href="/departamento/eletro">Eletro</Link>
              <Link href="/departamento/casa">Casa</Link>
              <Link href="/departamento/esporte">Esporte</Link>
              <Link href="/marketplace">Marketplace</Link>
            </nav>
          </div>
        </div>
      </header>
      <nav className="tabbar" aria-label="Navegação móvel">
        <Link href="/">Início</Link>
        <Link href="/produtos">Categorias</Link>
        <Link href="/produtos">Busca</Link>
        <Link href="/favoritos">Favoritos</Link>
        <Link href="/carrinho">
          Carrinho{cartCount > 0 ? ` (${cartCount})` : ''}
        </Link>
      </nav>
    </>
  );
}
