'use client';

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ProductCard, Product } from '@/components/ProductCard';
import { ProductGridSkeleton } from '@/components/Skeleton';
import {
  CATALOG_SORTS,
  activeFilterCount,
  buildFilterChips,
  emptySearchSuggestions,
  parseCatalogSort,
  searchEmptyCopy,
  searchResultsHeading,
  type FilterChip,
} from '@/lib/storefront-pro';

type Category = { id: string; name: string; slug: string };
type ListResponse = { items: Product[]; total?: number; page?: number; pageSize?: number; sort?: string };

function ProdutosInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const q = sp.get('q') || '';
  const category = sp.get('category') || '';
  const minPrice = sp.get('minPrice') || '';
  const maxPrice = sp.get('maxPrice') || '';
  const sort = parseCatalogSort(sp.get('sort'));

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [draftMin, setDraftMin] = useState(minPrice);
  const [draftMax, setDraftMax] = useState(maxPrice);
  const [draftCategory, setDraftCategory] = useState(category);
  const [draftSort, setDraftSort] = useState(sort);

  useEffect(() => {
    setDraftMin(minPrice);
    setDraftMax(maxPrice);
    setDraftCategory(category);
    setDraftSort(sort);
  }, [minPrice, maxPrice, category, sort]);

  useEffect(() => {
    api<Category[]>('/categories')
      .then((d) => setCategories(Array.isArray(d) ? d : []))
      .catch(() => setCategories([]));
  }, []);

  const categoryName = useMemo(() => {
    if (!category) return null;
    return categories.find((c) => c.slug === category)?.name || null;
  }, [categories, category]);

  const queryPath = useMemo(() => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (category) params.set('category', category);
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (sort && sort !== 'relevance') params.set('sort', sort);
    const qs = params.toString();
    return qs ? `/products?${qs}` : '/products';
  }, [q, category, minPrice, maxPrice, sort]);

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
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erro ao carregar produtos'))
      .finally(() => setLoading(false));
  }, [queryPath]);

  const pushFilters = useCallback(
    (next: Record<string, string>) => {
      const params = new URLSearchParams();
      const merged = {
        q,
        category,
        minPrice,
        maxPrice,
        sort,
        ...next,
      };
      Object.entries(merged).forEach(([k, v]) => {
        if (v && !(k === 'sort' && v === 'relevance')) params.set(k, v);
      });
      const qs = params.toString();
      router.push(qs ? `/produtos?${qs}` : '/produtos');
    },
    [router, q, category, minPrice, maxPrice, sort],
  );

  function applySheet(e: { preventDefault(): void }) {
    e.preventDefault();
    pushFilters({
      category: draftCategory.trim(),
      minPrice: draftMin.trim(),
      maxPrice: draftMax.trim(),
      sort: draftSort,
    });
    setSheetOpen(false);
  }

  function clearFilters() {
    router.push(q ? `/produtos?q=${encodeURIComponent(q)}` : '/produtos');
    setSheetOpen(false);
  }

  function clearAll() {
    router.push('/produtos');
    setSheetOpen(false);
  }

  function clearSearchKeepFilters() {
    pushFilters({ q: '' });
  }

  function clearChip(chip: FilterChip) {
    if (chip.clearKey === 'q') {
      pushFilters({ q: '' });
      return;
    }
    if (chip.clearKey === 'category') {
      pushFilters({ category: '' });
      return;
    }
    if (chip.clearKey === 'price') {
      pushFilters({ minPrice: '', maxPrice: '' });
      return;
    }
    if (chip.clearKey === 'sort') {
      pushFilters({ sort: 'relevance' });
      return;
    }
    clearAll();
  }

  const hasExtraFilters = Boolean(category || minPrice || maxPrice || (sort && sort !== 'relevance'));
  const hasAnyFilter = Boolean(q || hasExtraFilters);
  const chips = buildFilterChips({
    q,
    category,
    categoryName,
    minPrice,
    maxPrice,
    sort,
  });
  const filterCount = activeFilterCount({ q, category, minPrice, maxPrice, sort });
  const heading = searchResultsHeading(q, total, {
    loading,
    categoryName: categoryName || (category ? category : null),
  });
  const empty = searchEmptyCopy(q, hasExtraFilters);
  const suggestions = emptySearchSuggestions();

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
    <div className="sf-catalog" style={{ padding: '18px 0 28px' }}>
      <header className="sf-catalog-head">
        <p className="sf-catalog-kicker">Catálogo</p>
        <h1 className="sf-catalog-title">{heading.title}</h1>
        <p className="sf-catalog-sub muted">{heading.subtitle}</p>
        {q ? (
          <p className="sf-search-query" aria-live="polite">
            Busca: <strong>“{q}”</strong>
            {!loading && !err ? (
              <>
                {' '}
                · {total} resultado{total === 1 ? '' : 's'}
              </>
            ) : null}
          </p>
        ) : null}
      </header>

      <div className="sf-filter-bar" role="region" aria-label="Filtros do catálogo">
        <div className="sf-filter-bar-row">
          <button
            type="button"
            className="sf-filter-open"
            onClick={() => setSheetOpen(true)}
            aria-expanded={sheetOpen}
            aria-controls="sf-filter-sheet"
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
          {hasAnyFilter ? (
            <button className="btn ghost sf-filter-clear" type="button" onClick={clearAll}>
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

        {/* Desktop inline filters (hidden on small screens; sheet covers mobile) */}
        <div className="catalog-toolbar sf-catalog-toolbar-desktop">
          <label className="catalog-field">
            Categoria
            <select
              value={category}
              onChange={(e) => pushFilters({ category: e.target.value })}
              aria-label="Filtrar por categoria"
            >
              <option value="">Todas</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <form
            className="catalog-price"
            onSubmit={(e) => {
              e.preventDefault();
              pushFilters({ minPrice: draftMin.trim(), maxPrice: draftMax.trim() });
            }}
          >
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
            <button className="btn ghost" type="submit">
              Aplicar preço
            </button>
          </form>
        </div>
      </div>

      <nav className="sf-catalog-quicklinks" aria-label="Atalhos">
        <Link href="/">Início</Link>
        <span className="muted" aria-hidden>
          ·
        </span>
        <Link href="/departamento/ofertas">Ofertas</Link>
        <span className="muted" aria-hidden>
          ·
        </span>
        <Link href="/departamento/eletro">TVs e Áudio</Link>
        <span className="muted" aria-hidden>
          ·
        </span>
        <Link href="/departamento/celulares">Celulares</Link>
        <span className="muted" aria-hidden>
          ·
        </span>
        <Link href="/marketplace">Marketplace</Link>
      </nav>

      {err ? <div className="alert">{err}</div> : null}
      {loading ? <ProductGridSkeleton count={8} /> : null}
      {!loading && !err && products.length === 0 ? (
        <div className="catalog-empty sf-catalog-empty">
          <p className="sf-catalog-empty-title">{empty.title}</p>
          <p className="muted sf-catalog-empty-body">{empty.body}</p>
          <div className="sf-catalog-empty-actions">
            {hasAnyFilter ? (
              <button className="btn" type="button" onClick={clearAll}>
                {empty.clearFiltersLabel}
              </button>
            ) : null}
            {q ? (
              <button className="btn ghost" type="button" onClick={clearSearchKeepFilters}>
                {empty.clearSearchLabel}
              </button>
            ) : null}
            {hasExtraFilters && q ? (
              <button className="btn ghost" type="button" onClick={clearFilters}>
                Manter busca, limpar filtros
              </button>
            ) : null}
            <Link className="btn ghost" href="/">
              Voltar ao início
            </Link>
          </div>
          <ul className="sf-empty-suggestions" aria-label="Sugestões">
            {suggestions.map((s) => (
              <li key={s.href}>
                <Link href={s.href}>{s.label}</Link>
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

      {sheetOpen ? (
        <div
          className="sf-filter-sheet-backdrop"
          role="presentation"
          onClick={() => setSheetOpen(false)}
        >
          <div
            id="sf-filter-sheet"
            className="sf-filter-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Filtros"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sf-filter-sheet-head">
              <h2>Filtros</h2>
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
                Categoria
                <select
                  value={draftCategory}
                  onChange={(e) => setDraftCategory(e.target.value)}
                  aria-label="Filtrar por categoria"
                >
                  <option value="">Todas</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
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
                  Ver resultados
                </button>
                {hasAnyFilter ? (
                  <button className="btn ghost" type="button" onClick={clearAll}>
                    Limpar tudo
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

export default function ProdutosPage() {
  return (
    <Suspense fallback={<ProductGridSkeleton count={8} />}>
      <ProdutosInner />
    </Suspense>
  );
}
