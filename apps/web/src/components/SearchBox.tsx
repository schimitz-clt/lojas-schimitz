'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { api } from '@/lib/api';
import {
  clearSearchHistory,
  persistSearchTerm,
  readSearchHistory,
  searchHistoryClearLabel,
  searchHistoryHeading,
  shouldShowSearchHistory,
} from '@/lib/search-history';
import {
  SEARCH_SUGGEST_DEBOUNCE_MS,
  buildSuggestionRows,
  catalogSearchHref,
  categoriesFromListResponse,
  hasCatalogSuggestionHits,
  nextSuggestionIndex,
  productsFromListResponse,
  searchBoxAriaControlsId,
  shouldFetchSuggestions,
  suggestionsStatusLabel,
  type SearchCategoryLike,
  type SearchProductLike,
  type SuggestionKind,
  type SuggestionRow,
} from '@/lib/search-suggestions';
import {
  emptySearchSuggestions,
  isExternalSearchShortcut,
  searchEmptyCopy,
} from '@/lib/storefront-pro';

type Props = {
  initialQuery?: string;
};

type PanelKind = SuggestionKind | 'history' | 'shortcut';

type PanelItem = {
  id: string;
  kind: PanelKind;
  href: string;
  label: string;
  sub?: string;
  image?: string;
  priceLabel?: string;
  pixLabel?: string;
  pixTag?: string;
  external?: boolean;
};

function kindLabel(kind: PanelKind): string {
  if (kind === 'category') return 'Depto';
  if (kind === 'all') return 'Busca';
  if (kind === 'history') return 'Recente';
  if (kind === 'shortcut') return 'Atalho';
  return 'Produto';
}

export function SearchBox({ initialQuery = '' }: Props) {
  const [q, setQ] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<SearchProductLike[]>([]);
  const [allCats, setAllCats] = useState<SearchCategoryLike[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [active, setActive] = useState(-1);
  const [fetchedTerm, setFetchedTerm] = useState('');
  const wrapRef = useRef<HTMLFormElement>(null);
  const listId = searchBoxAriaControlsId();
  const statusId = useId();
  const reqRef = useRef(0);

  useEffect(() => {
    setQ(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    setHistory(readSearchHistory());
  }, []);

  useEffect(() => {
    api<unknown>('/categories')
      .then((d) => setAllCats(categoriesFromListResponse(d)))
      .catch(() => setAllCats([]));
  }, []);

  useEffect(() => {
    if (!shouldFetchSuggestions(q)) {
      setProducts([]);
      setLoading(false);
      setActive(-1);
      setFetchedTerm('');
      if (q.trim().length > 0) setOpen(false);
      return;
    }
    setLoading(true);
    const handle = window.setTimeout(() => {
      const seq = ++reqRef.current;
      const term = q.trim();
      api<unknown>(`/products?q=${encodeURIComponent(term)}&pageSize=8`)
        .then((data) => {
          if (seq !== reqRef.current) return;
          setProducts(productsFromListResponse(data));
          setFetchedTerm(term);
          setOpen(true);
          setActive(-1);
        })
        .catch(() => {
          if (seq !== reqRef.current) return;
          setProducts([]);
          setFetchedTerm(term);
          setOpen(true);
          setActive(-1);
        })
        .finally(() => {
          if (seq === reqRef.current) setLoading(false);
        });
    }, SEARCH_SUGGEST_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [q]);

  useEffect(() => {
    function onDoc(ev: MouseEvent) {
      if (!wrapRef.current) return;
      if (ev.target instanceof Node && !wrapRef.current.contains(ev.target)) {
        setOpen(false);
        setActive(-1);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const fetching = shouldFetchSuggestions(q);
  const catalogRows: SuggestionRow[] = fetching
    ? buildSuggestionRows({ q, products, categories: allCats })
    : [];
  const showHistory = open && shouldShowSearchHistory(q, history.length);
  const hasHits = hasCatalogSuggestionHits(catalogRows);
  const resultsForQuery = fetchedTerm.trim() === q.trim();
  const showEmpty = open && fetching && !loading && resultsForQuery && !hasHits;
  const emptyCopy = showEmpty ? searchEmptyCopy(q.trim(), false) : null;
  const shortcuts = showEmpty ? emptySearchSuggestions() : [];

  const navRows: PanelItem[] = showHistory
    ? history.map((term, i) => ({
        id: `h-${i}`,
        kind: 'history',
        href: catalogSearchHref(term),
        label: term,
      }))
    : showEmpty
      ? [
          ...shortcuts.map((s, i) => ({
            id: `sc-${i}`,
            kind: 'shortcut' as const,
            href: s.href,
            label: s.label,
            external: isExternalSearchShortcut(s),
          })),
          ...catalogRows.map((row) => ({ ...row })),
        ]
      : catalogRows.map((row) => ({ ...row }));

  const showList =
    open &&
    (showHistory ||
      (fetching && (loading || catalogRows.length > 0 || showEmpty)));
  const status = showHistory
    ? `${history.length} busca${history.length === 1 ? '' : 's'} recente${history.length === 1 ? '' : 's'}`
    : suggestionsStatusLabel({ q, loading, count: catalogRows.length });

  function go(href: string, opts?: { remember?: string; external?: boolean }) {
    if (opts?.remember) {
      setHistory(persistSearchTerm(opts.remember));
    }
    setOpen(false);
    setActive(-1);
    if (opts?.external) {
      window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }
    window.location.href = href;
  }

  function submitTerm() {
    go(catalogSearchHref(q), { remember: q });
  }

  function activateRow(row: PanelItem) {
    if (row.kind === 'history') {
      go(row.href, { remember: row.label });
      return;
    }
    if (row.kind === 'shortcut') {
      go(row.href, { external: row.external });
      return;
    }
    go(row.href, { remember: fetching ? q : undefined });
  }

  return (
    <form
      ref={wrapRef}
      className="search"
      action="/produtos"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (active >= 0 && navRows[active]) {
          activateRow(navRows[active]);
          return;
        }
        submitTerm();
      }}
    >
      <input
        name="q"
        placeholder="O que você está procurando?"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(-1);
          if (!e.target.value.trim()) {
            setHistory(readSearchHistory());
            setOpen(true);
          }
        }}
        onFocus={() => {
          setHistory(readSearchHistory());
          if (shouldFetchSuggestions(q) && (catalogRows.length > 0 || loading)) {
            setOpen(true);
            return;
          }
          if (!q.trim()) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
            setActive(-1);
            return;
          }
          if (!showList || navRows.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActive((cur) => nextSuggestionIndex(cur, navRows.length, 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setOpen(true);
            setActive((cur) => nextSuggestionIndex(cur, navRows.length, -1));
          }
        }}
        aria-label="Buscar produtos"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={
          active >= 0 && navRows[active] ? `${listId}-${navRows[active].id}` : undefined
        }
        autoComplete="off"
      />
      <button type="submit" className="search-submit" aria-label="Buscar">
        🔍
      </button>
      <p id={statusId} className="sr-only" aria-live="polite">
        {status}
      </p>
      {showList ? (
        <div className="search-suggest">
          {showHistory ? (
            <div className="search-suggest-head">
              <p className="search-suggest-heading">{searchHistoryHeading()}</p>
              <button
                type="button"
                className="search-suggest-clear"
                onClick={() => {
                  setHistory(clearSearchHistory());
                  setOpen(false);
                  setActive(-1);
                }}
              >
                {searchHistoryClearLabel()}
              </button>
            </div>
          ) : null}
          {showEmpty && emptyCopy ? (
            <div className="search-suggest-empty" role="status">
              <p className="search-suggest-empty-title">{emptyCopy.title}</p>
              <p className="search-suggest-empty-body">{emptyCopy.body}</p>
            </div>
          ) : null}
          {loading && !hasHits && !showHistory ? (
            <p className="search-suggest-status">Buscando…</p>
          ) : null}
          <ul id={listId} className="search-suggest-list" role="listbox" aria-label="Sugestões de busca">
            {navRows.map((row, i) => (
              <li key={row.id} role="presentation">
                <button
                  type="button"
                  id={`${listId}-${row.id}`}
                  role="option"
                  aria-selected={i === active}
                  className={`search-suggest-item search-suggest-${row.kind}${i === active ? ' is-active' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => activateRow(row)}
                >
                  {row.kind === 'product' ? (
                    row.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className="search-suggest-thumb"
                        src={row.image}
                        alt=""
                        width={44}
                        height={44}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <span className="search-suggest-thumb search-suggest-thumb-ph" aria-hidden>
                        LS
                      </span>
                    )
                  ) : (
                    <span className="search-suggest-kind">{kindLabel(row.kind)}</span>
                  )}
                  <span className="search-suggest-copy">
                    <span className="search-suggest-label">{row.label}</span>
                    {row.kind === 'product' && (row.priceLabel || row.pixLabel) ? (
                      <span className="search-suggest-prices">
                        {row.priceLabel ? (
                          <span className="search-suggest-price">{row.priceLabel}</span>
                        ) : null}
                        {row.pixLabel ? (
                          <span className="search-suggest-pix">
                            {row.pixLabel}
                            {row.pixTag ? ` · ${row.pixTag}` : ''}
                          </span>
                        ) : null}
                      </span>
                    ) : row.sub ? (
                      <span className="search-suggest-sub">{row.sub}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </form>
  );
}
