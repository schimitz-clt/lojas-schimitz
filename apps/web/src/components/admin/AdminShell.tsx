'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ADMIN_NAV_ITEMS,
  type AdminSectionId,
  adminSectionLabel,
  buildAdminSectionHref,
} from '@/lib/admin-sections';
import './admin-theme.css';

export type AdminShellBadges = Partial<{
  paid: number;
  recon: number;
  lowStock: number;
  alerts: number;
}>;

type AdminShellProps = {
  section: AdminSectionId;
  onSectionChange: (section: AdminSectionId) => void;
  badges?: AdminShellBadges;
  /** Optional right-side header actions (logout etc.) */
  headerActions?: ReactNode;
  children: ReactNode;
};

const MOBILE_PRIMARY: AdminSectionId[] = [
  'ops',
  'pedidos',
  'catalogo',
  'clientes',
  'vendas',
];

function badgeFor(
  key: keyof AdminShellBadges | undefined,
  badges?: AdminShellBadges,
): number | null {
  if (!key || !badges) return null;
  const n = badges[key];
  if (n == null || n <= 0) return null;
  return n;
}

export function AdminShell({
  section,
  onSectionChange,
  badges,
  headerActions,
  children,
}: AdminShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const go = useCallback(
    (id: AdminSectionId) => {
      onSectionChange(id);
      setDrawerOpen(false);
      if (typeof window !== 'undefined') {
        const href = buildAdminSectionHref(id);
        window.history.replaceState(null, '', href);
      }
    },
    [onSectionChange],
  );

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const sectionTitle = adminSectionLabel(section);
  const alertCount = badges?.alerts ?? 0;

  return (
    <div className="admin-app">
      <header className="admin-header">
        <button
          type="button"
          className="admin-header__menu-btn"
          aria-label={drawerOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen((v) => !v)}
        >
          {drawerOpen ? '✕' : '☰'}
        </button>
        <div className="admin-header__brand">
          SCHIMITZ <span>Admin</span>
        </div>
        <div className="admin-header__meta">
          Console operacional · {sectionTitle}
        </div>
        <div className="admin-header__actions">
          {alertCount > 0 ? (
            <span className="admin-header__chip" title="Alertas no snapshot">
              {alertCount} alerta{alertCount === 1 ? '' : 's'}
            </span>
          ) : (
            <span className="admin-header__chip" style={{ opacity: 0.7 }}>
              Ops
            </span>
          )}
          {headerActions}
        </div>
      </header>

      <div className="admin-body">
        {drawerOpen ? (
          <button
            type="button"
            className="admin-drawer-backdrop"
            aria-label="Fechar menu"
            onClick={() => setDrawerOpen(false)}
          />
        ) : null}

        <nav
          className={`admin-sidebar${drawerOpen ? ' is-open' : ''}`}
          aria-label="Navegação do admin"
        >
          <div className="admin-sidebar__label">Principal</div>
          {ADMIN_NAV_ITEMS.slice(0, 5).map((item) => {
            const b = badgeFor(item.badgeKey, badges);
            return (
              <button
                key={item.id}
                type="button"
                className={`admin-nav-item${section === item.id ? ' is-active' : ''}`}
                onClick={() => go(item.id)}
              >
                <span className="admin-nav-item__text">
                  <span className="admin-nav-item__label">{item.label}</span>
                  <span className="admin-nav-item__desc">{item.description}</span>
                </span>
                {b != null ? <span className="admin-nav-item__badge">{b > 99 ? '99+' : b}</span> : null}
              </button>
            );
          })}
          <div className="admin-sidebar__label">Loja</div>
          {ADMIN_NAV_ITEMS.slice(5).map((item) => {
            const b = badgeFor(item.badgeKey, badges);
            return (
              <button
                key={item.id}
                type="button"
                className={`admin-nav-item${section === item.id ? ' is-active' : ''}`}
                onClick={() => go(item.id)}
              >
                <span className="admin-nav-item__text">
                  <span className="admin-nav-item__label">{item.label}</span>
                  <span className="admin-nav-item__desc">{item.description}</span>
                </span>
                {b != null ? <span className="admin-nav-item__badge">{b > 99 ? '99+' : b}</span> : null}
              </button>
            );
          })}
        </nav>

        <main className="admin-main">
          <h1 className="admin-main__title">{sectionTitle}</h1>
          <p className="admin-main__sub">
            Painel da loja — dados reais, sem simulação. Use o menu para mudar de seção.
          </p>
          {children}
        </main>
      </div>

      <nav className="admin-mobile-nav" aria-label="Atalhos mobile">
        {MOBILE_PRIMARY.map((id) => {
          const item = ADMIN_NAV_ITEMS.find((n) => n.id === id)!;
          const b = badgeFor(item.badgeKey, badges);
          return (
            <button
              key={id}
              type="button"
              className={`admin-mobile-nav__btn${section === id ? ' is-active' : ''}`}
              onClick={() => go(id)}
            >
              {b != null ? <span className="admin-mobile-nav__dot" aria-hidden /> : null}
              <span>{item.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          className={`admin-mobile-nav__btn${
            !MOBILE_PRIMARY.includes(section) ? ' is-active' : ''
          }`}
          onClick={() => setDrawerOpen(true)}
          aria-label="Mais seções"
        >
          Mais
        </button>
      </nav>
    </div>
  );
}
