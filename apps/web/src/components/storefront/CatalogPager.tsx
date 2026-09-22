'use client';

import { catalogPageCount, catalogPageRange, CATALOG_PAGE_SIZE } from '@/lib/catalog-pagination';

export function CatalogPager({
  page,
  total,
  pageSize = CATALOG_PAGE_SIZE,
  onPage,
}: {
  page: number;
  total: number;
  pageSize?: number;
  onPage: (page: number) => void;
}) {
  if (total <= pageSize) return null;
  const pages = catalogPageCount(total, pageSize);
  const range = catalogPageRange(page, total, pageSize);
  return (
    <nav className="sf-catalog-pager" aria-label="Páginas do catálogo">
      <p className="sf-catalog-pager-range">
        {range.start}–{range.end} de {total}
      </p>
      <div className="sf-catalog-pager-actions">
        <button
          type="button"
          className="btn ghost"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Anterior
        </button>
        <span>
          Página {page} de {pages}
        </span>
        <button
          type="button"
          className="btn ghost"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Próxima
        </button>
      </div>
    </nav>
  );
}
