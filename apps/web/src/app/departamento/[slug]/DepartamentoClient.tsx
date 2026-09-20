'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { ProductCard, Product } from '@/components/ProductCard';
import { ProductGridSkeleton } from '@/components/Skeleton';
import { HOME_CATEGORIES } from '@/lib/category-visual';
import {
  CATALOG_SORTS,
  activeFilterCount,
  buildFilterChips,
  departmentTitle,
  emptySearchSuggestions,
  isExternalSearchShortcut,
  parseCatalogSort,
  searchEmptyCopy,
  type FilterChip,
} from '@/lib/storefront-pro';
import { RecentlyViewedStrip } from '@/components/RecentlyViewedStrip';

type Category = { id: string; name: string; slug: string };
type ListResponse = { items: Product[]; total?: number };

export default function DepartamentoClient() {
  const { slug } = useParams<{ slug: string }>();
  const sp = useSearchParams();
  const router = useRouter();

  const minPrice = sp.get('minPrice') || '';
  const maxPrice = sp.get('maxPrice') || '';
  const sort = parseCatalogSort(sp.get('sort') || 'newest');

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draftMin, setDraftMin] = useState(minPrice);
  const [draftMax, setDraftMax] = useState(maxPrice);
  const [draftSort, setDraftSort] = useState(sort);

  useEffect(() => {
    setDraftMin(minPrice);
    setDraftMax(maxPrice);
    setDraftSort(sort);
  }, [minPrice, maxPrice, sort]);

  useEffect(() => {
    api<Category[]>('/categories')
      .then((d) => setCategories(Array.isArray(d) ? d : []))
      .catch(() => setCategories([]));
  }, []);

  const apiName = useMemo(
    () => categories.find((c) => c.slug === slug)?.name || null,
    [categories, slug],
  );
  const title = departmentTitle(slug, apiName);

  const queryPath = useMemo(() => {
    const params = new URLSearchParams();
    params.set('category', slug);
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (sort) params.set('sort', sort);
    return `/products?${params.toString()}`;
  }, [slug, minPrice, maxPrice, sort]);

  useEffect(() => {
    setLoading(true);
    setErr('');
    api<Product[] | ListResponse>(queryPath)
      .then((d) => {
        if (Array.isArray(d)) {
          setProducts(d);
          setTotal(d.length);
        } else {
          setProducts(d.items || []);
          setTotal(d.total ?? (d.items || []).length);
        }
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [queryPath]);

  const pushFilters = useCallback(
    (next: Record<string, string>) => {
      const params = new URLSearchParams();
      const merged = { minPrice, maxPrice, sort, ...next };
      Object.entries(merged).forEach(([k, v]) => {
        if (!v) return;
        if (k === 'sort' && v === 'relevance') return;
        params.set(k, v);
      });
      const qs = params.toString();
      router.push(qs ? `/departamento/${encodeURIComponent(slug)}?${qs}` : `/departamento/${encodeURIComponent(slug)}`);
    },
    [router, slug, minPrice, maxPrice, sort],
  );

  function applySheet(e: { preventDefault(): void }) {
    e.preventDefault();
    pushFilters({
      minPrice: draftMin.trim(),
      maxPrice: draftMax.trim(),
      sort: draftSort,
    });
    setSheetOpen(false);
  }

  function clearExtra() {
    router.push(`/departamento/${encodeURIComponent(slug)}`);
    setSheetOpen(false);
  }

  function clearChip(chip: FilterChip) {
    if (chip.clearKey === 'price') {
      pushFilters({ minPrice: '', maxPrice: '' });
      return;
    }
    if (chip.clearKey === 'sort') {
      pushFilters({ sort: 'newest' });
      return;
    }
  }

  // Default dept sort is newest — omit from chips/count unless user changed it.
  const chips = buildFilterChips({
    category: slug,
    categoryName: title,
    minPrice,
    maxPrice,
    sort: sort === 'newest' ? 'relevance' : sort,
  }).filter((c) => c.clearKey !== 'category');

  const filterCount = activeFilterCount({
    minPrice,
    maxPrice,
    sort: sort === 'newest' ? undefined : sort,
  });
  const hasExtra = Boolean(minPrice || maxPrice || (sort && sort !== 'newest'));
  const empty = searchEmptyCopy('', hasExtra);
  const siblingNav = HOME_CATEGORIES.filter((c) => c.slug !== 'marketplace');

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setSheetOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [sheetOpen]);

  return (
    <div className="sf-catalog sf-dept" style={{ padding: '18px 0 28px' }}>
      <header className="sf-dept-hero">
        <p className="sf-catalog-kicker">Departamento</p>
        <h1 className="sf-catalog-title">{title}</h1>
        <p className="sf-catalog-sub muted">
          {loading
            ? 'Carregando produtos…'
            : `${total === 1 ? '1 produto' : `${total.toLocaleString('pt-BR')} produtos`} · Lojas Schimitz`}
        </p>
        <p className="sf-dept-crumbs muted">
          <Link href="/">Início</Link>
          <span aria-hidden> · </span>
          <Link href="/produtos">Catálogo</Link>
          <span aria-hidden> · </span>
          <span>{title}</span>
        </p>
      </header>

      <nav className="sf-dept-siblings" aria-label="Outros departamentos">
        {siblingNav.map((c) => (
          <Link
            key={c.slug}
            href={c.href}
            className={`sf-dept-pill${c.slug === slug ? ' is-active' : ''}`}
            aria-current={c.slug === slug ? 'page' : undefined}
          >
            {c.label}
          </Link>
        ))}
      </nav>

      <div className="sf-filter-bar" role="region" aria-label="Filtros do departamento">
        <div className="sf-filter-bar-row">
          <button
            type="button"
            className="sf-filter-open"
            onClick={() => setSheetOpen(true)}
            aria-expanded={sheetOpen}
            aria-controls="sf-dept-filter-sheet"
          >
            Filtros{filterCount > 0 ? ` (${filterCount})` : ''}
          </button>
          <label className="sf-filter-sort catalog-field">
            <span className="sf-filter-sort-label">Ordenar</span>
            <select
              value={sort}
              onChange={(e) => pushFilters({ sort: e.target.value })}
              aria-label="Ordenar produtos"
            >
              {CATALOG_SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <Link
            className="btn ghost sf-filter-clear"
            href={`/produtos?category=${encodeURIComponent(slug)}`}
          >
            Mais filtros
          </Link>
          {hasExtra ? (
            <button className="btn ghost sf-filter-clear" type="button" onClick={clearExtra}>
              Limpar
            </button>
          ) : null}
        </div>
        {chips.length > 0 ? (
          <ul className="sf-filter-chips" aria-label="Filtros ativos">
            {chips.map((chip) => (
              <li key={chip.id}>
                <button
                  type="button"
                  className="sf-filter-chip"
                  onClick={() => clearChip(chip)}
                  aria-label={`Remover filtro ${chip.label}`}
                >
                  <span>{chip.label}</span>
                  <span aria-hidden className="sf-filter-chip-x">
                    ×
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {err ? <div className="alert">{err}</div> : null}
      {loading ? <ProductGridSkeleton count={6} /> : null}
      {!loading && !err && products.length === 0 ? (
        <div className="catalog-empty sf-catalog-empty">
          <p className="sf-catalog-empty-title">
            {hasExtra ? empty.title : 'Nenhum produto neste departamento.'}
          </p>
          <p className="muted sf-catalog-empty-body">
            {hasExtra
              ? empty.body
              : 'Veja todos os produtos ou explore outro departamento.'}
          </p>
          <div className="sf-catalog-empty-actions">
            {hasExtra ? (
              <button className="btn" type="button" onClick={clearExtra}>
                Limpar filtros
              </button>
            ) : null}
            <Link className="btn ghost" href="/produtos">
              Ver catálogo
            </Link>
            <Link className="btn ghost" href="/marketplace">
              Marketplace
            </Link>
          </div>
          <ul className="sf-empty-suggestions" aria-label="Sugestões">
            {emptySearchSuggestions()
              .filter((s) => !s.href.includes(slug))
              .map((s) => (
                <li key={s.href}>
                  {isExternalSearchShortcut(s) ? (
                    <a href={s.href} target="_blank" rel="noopener noreferrer">
                      {s.label}
                    </a>
                  ) : (
                    <Link href={s.href}>{s.label}</Link>
                  )}
                </li>
              ))}
          </ul>
        </div>
      ) : null}
      {!loading ? (
        <div className="grid">
          {products.map((p, i) => (
            <ProductCard key={p.id} p={p} priority={i < 4} />
          ))}
        </div>
      ) : null}

      <RecentlyViewedStrip />

      {sheetOpen ? (
        <div
          className="sf-filter-sheet-backdrop"
          role="presentation"
          onClick={() => setSheetOpen(false)}
        >
          <div
            id="sf-dept-filter-sheet"
            className="sf-filter-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Filtros do departamento"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sf-filter-sheet-head">
              <h2>Filtros · {title}</h2>
              <button
                type="button"
                className="sf-filter-sheet-close"
                onClick={() => setSheetOpen(false)}
                aria-label="Fechar filtros"
              >
                ×
              </button>
            </div>
            <form className="sf-filter-sheet-body" onSubmit={applySheet}>
              <label className="catalog-field">
                Ordenar
                <select
                  value={draftSort}
                  onChange={(e) => setDraftSort(parseCatalogSort(e.target.value))}
                  aria-label="Ordenar produtos"
                >
                  {CATALOG_SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="catalog-price sf-filter-sheet-price">
                <label className="catalog-field">
                  Preço mín.
                  <input
                    inputMode="decimal"
                    placeholder="0"
                    value={draftMin}
                    onChange={(e) => setDraftMin(e.target.value)}
                    aria-label="Preço mínimo"
                  />
                </label>
                <label className="catalog-field">
                  Preço máx.
                  <input
                    inputMode="decimal"
                    placeholder="9999"
                    value={draftMax}
                    onChange={(e) => setDraftMax(e.target.value)}
                    aria-label="Preço máximo"
                  />
                </label>
              </div>
              <div className="sf-filter-sheet-actions">
                <button className="btn" type="submit">
                  Ver produtos
                </button>
                {hasExtra ? (
                  <button className="btn ghost" type="button" onClick={clearExtra}>
                    Limpar
                  </button>
                ) : null}
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
