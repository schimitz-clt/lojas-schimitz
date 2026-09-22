'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ADMIN_NAV_GROUPS,
  adminNavGroupFor,
  adminNavItem,
  type AdminNavAliasTip,
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

export type AdminAttentionSnapshot = 'pending' | 'ready' | 'error';

type AdminShellProps = {
  section: AdminSectionId;
  onSectionChange: (section: AdminSectionId) => void;
  badges?: AdminShellBadges;
  /** Snapshot of GET /admin/ops — chip stays quiet until it is real. */
  attentionSnapshot?: AdminAttentionSnapshot;
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

function pageLead(section: AdminSectionId, description: string): string {
  if (section === 'ops') {
    return 'O que está acontecendo, o que precisa de atenção e o que dá para fazer agora — só com o snapshot real.';
  }
  return description;
}

function NavItem({
  id,
  section,
  badges,
  onGo,
}: {
  id: AdminSectionId;
  section: AdminSectionId;
  badges?: AdminShellBadges;
  onGo: (id: AdminSectionId) => void;
}) {
  const item = adminNavItem(id);
  const b = badgeFor(item.badgeKey, badges);
  const active = section === item.id;
  return (
    <Link
      href={buildAdminSectionHref(item.id)}
      className={`admin-nav-item${active ? ' is-active' : ''}`}
      aria-current={active ? 'page' : undefined}
      onClick={() => onGo(item.id)}
    >
      <span className="admin-nav-item__text">
        <span className="admin-nav-item__label">{item.label}</span>
        <span className="admin-nav-item__desc">{item.description}</span>
      </span>
      {b != null ? <span className="admin-nav-item__badge">{b > 99 ? '99+' : b}</span> : null}
    </Link>
  );
}

function AliasTip({
  tip,
  section,
  onGo,
}: {
  tip: AdminNavAliasTip;
  section: AdminSectionId;
  onGo: (id: AdminSectionId) => void;
}) {
  const related = section === tip.target;
  return (
    <Link
      href={buildAdminSectionHref(tip.target)}
      className={`admin-nav-alias${related ? ' is-related' : ''}`}
      aria-label={`${tip.label}, atalho para ${adminSectionLabel(tip.target)}. Não é uma seção separada.`}
      onClick={() => onGo(tip.target)}
    >
      <span className="admin-nav-alias__kicker">Atalho</span>
      <span className="admin-nav-alias__label">{tip.label}</span>
      <span className="admin-nav-alias__note">{tip.note}</span>
    </Link>
  );
}

export function AdminBrandMark() {
  return (
    <div className="admin-header__brand">
      <span className="admin-header__mark" aria-hidden="true" />
      <span className="admin-header__word">SCHIMITZ</span>
      <span className="admin-header__product">Admin</span>
    </div>
  );
}

export function AdminShell({
  section,
  onSectionChange,
  badges,
  attentionSnapshot = 'pending',
  headerActions,
  children,
}: AdminShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const go = useCallback(
    (id: AdminSectionId) => {
      onSectionChange(id);
      setDrawerOpen(false);
    },
    [onSectionChange],
  );

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  const sectionTitle = adminSectionLabel(section);
  const group = adminNavGroupFor(section);
  const current = adminNavItem(section);
  const alertCount = badges?.alerts ?? 0;
  const showAlertChip = attentionSnapshot === 'ready';

  return (
    <div className="admin-app">
      <a className="admin-skip" href="#admin-content">
        Ir para o conteúdo
      </a>
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
        <AdminBrandMark />
        <div className="admin-header__meta">
          <span className="admin-header__group">{group.label}</span>
          <span className="admin-header__sep" aria-hidden="true">
            ·
          </span>
          <span>{sectionTitle}</span>
        </div>
        <div className="admin-header__actions">
          {showAlertChip && alertCount > 0 ? (
            <span className="admin-header__chip" title="Alertas no snapshot">
              {alertCount} alerta{alertCount === 1 ? '' : 's'}
            </span>
          ) : null}
          {showAlertChip && alertCount === 0 ? (
            <span className="admin-header__chip admin-header__chip--quiet" title="Snapshot sem alertas">
              Sem alertas
            </span>
          ) : null}
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
          {ADMIN_NAV_GROUPS.map((navGroup) => (
            <div key={navGroup.id} className="admin-nav-group">
              <div
                className={`admin-sidebar__label${
                  navGroup.id === group.id ? ' is-current' : ''
                }`}
              >
                {navGroup.label}
              </div>
              {navGroup.itemIds.map((id) => (
                <NavItem key={id} id={id} section={section} badges={badges} onGo={go} />
              ))}
              {navGroup.aliasTip ? (
                <AliasTip tip={navGroup.aliasTip} section={section} onGo={go} />
              ) : null}
            </div>
          ))}
        </nav>

        <main className="admin-main" id="admin-content">
          <header className="admin-page-head">
            <p className="admin-page-head__eyebrow">{group.label}</p>
            <h1 className="admin-main__title">{sectionTitle}</h1>
            <p className="admin-main__sub">{pageLead(section, current.description)}</p>
          </header>
          {children}
        </main>
      </div>

      <nav className="admin-mobile-nav" aria-label="Atalhos mobile">
        {MOBILE_PRIMARY.map((id) => {
          const item = adminNavItem(id);
          const b = badgeFor(item.badgeKey, badges);
          const active = section === id;
          return (
            <Link
              key={id}
              href={buildAdminSectionHref(id)}
              className={`admin-mobile-nav__btn${active ? ' is-active' : ''}`}
              aria-current={active ? 'page' : undefined}
              onClick={() => go(id)}
            >
              {b != null ? <span className="admin-mobile-nav__dot" aria-hidden /> : null}
              <span>{item.label}</span>
            </Link>
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
