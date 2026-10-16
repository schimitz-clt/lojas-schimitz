'use client';

import type { ReactNode } from 'react';

/** Barra padrão das listas: busca, ordenação, filtros (chips) e contagem. */
export function AdminListBar({
  search,
  onSearch,
  searchLabel,
  placeholder,
  sort,
  sorts,
  onSort,
  children,
  count,
}: {
  search?: string;
  onSearch?: (v: string) => void;
  searchLabel?: string;
  placeholder?: string;
  sort?: string;
  sorts?: { id: string; label: string }[];
  onSort?: (v: string) => void;
  children?: ReactNode;
  count?: string;
}) {
  return (
    <div className="admin-listbar" role="search">
      {onSearch ? (
        <label className="admin-listbar__search">
          <span className="admin-sr">{searchLabel || 'Buscar'}</span>
          <input type="search" value={search ?? ''} onChange={(e) => onSearch(e.target.value)} placeholder={placeholder || 'Buscar'} aria-label={searchLabel || 'Buscar'} />
        </label>
      ) : null}
      {sorts && onSort ? (
        <label className="admin-listbar__sort">
          <span>Ordenar</span>
          <select value={sort} onChange={(e) => onSort(e.target.value)} aria-label="Ordenar">
            {sorts.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </label>
      ) : null}
      {children ? <div className="admin-listbar__chips">{children}</div> : null}
      {count ? <p className="admin-listbar__count" role="status">{count}</p> : null}
    </div>
  );
}

/** Paginação padrão: anterior / próxima, com "x–y de z". */
export function AdminPager({ page, pages, from, to, total, onPage }: { page: number; pages: number; from: number; to: number; total: number; onPage: (p: number) => void }) {
  if (total === 0) return null;
  return (
    <nav className="admin-pager" aria-label="Paginação">
      <button type="button" className="btn ghost admin-btn-ghost-pro" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Anterior
      </button>
      <span>
        {from}–{to} de {total} · página {page} de {pages}
      </span>
      <button type="button" className="btn ghost admin-btn-ghost-pro" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Próxima
      </button>
    </nav>
  );
}
