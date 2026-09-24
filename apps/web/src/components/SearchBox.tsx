'use client';

import { Fragment, useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { SEARCH_OPEN_CLASS } from '@/lib/search-chrome';
import {
  clearSearchHistory,
  forgetSearchTerm,
  persistSearchTerm,
  readSearchHistory,
  searchHistoryClearLabel,
  searchHistoryHeading,
  searchHistoryRemoveAria,
  shouldShowSearchHistory,
} from '@/lib/search-history';
import {
  SEARCH_SUGGEST_DEBOUNCE_MS,
  buildSuggestionRows,
  catalogSearchHref,
  categoriesFromListResponse,
  focusCategoryShortcuts,
  focusTrendingRows,
  hasCatalogSuggestionHits,
  highlightProductsFromShelves,
  nextSuggestionIndex,
  productsFromListResponse,
  searchBoxAriaControlsId,
  searchDepartmentsHeading,
  searchFocusHeading,
  shouldFetchSuggestions,
  shouldOpenSuggestionPanel,
  shouldShowTrendingHeading,
  suggestionLabelParts,
  suggestionsStatusLabel,
  type SearchCategoryLike,
  type SearchProductLike,
  type SuggestionKind,
  type SuggestionRow,
} from '@/lib/search-suggestions';
import { searchEmptyCopy } from '@/lib/storefront-pro';
import { IconSearch } from '@/components/icons/StorefrontIcons';
import { internalAppPath, requestNavigationProgress } from '@/lib/navigation-progress';

type Props = {
  initialQuery?: string;
};

type PanelKind = SuggestionKind | 'history';
type PanelSection = 'history' | 'trending' | 'departments';

type PanelItem = {
  id: string;
  kind: PanelKind;
  href: string;
  label: string;
  section?: PanelSection;
};

function sectionHeading(section: PanelSection | undefined): string | null {
  if (section === 'history') return searchHistoryHeading();
  if (section === 'trending') return searchFocusHeading();
  if (section === 'departments') return searchDepartmentsHeading();
  return null;
}

function SuggestLabel({ label, q }: { label: string; q: string }) {
  const parts = suggestionLabelParts(label, q);
  return (
    <span className="search-suggest-label">
      {parts.before}
      {parts.match}
      {parts.after ? <strong className="search-suggest-emph">{parts.after}</strong> : null}
    </span>
  );
}

export function SearchBox({ initialQuery = '' }: Props) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<SearchProductLike[]>([]);
  const [allCats, setAllCats] = useState<SearchCategoryLike[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [highlights, setHighlights] = useState<SearchProductLike[]>([]);
  const [active, setActive] = useState(-1);
  const [fetchedTerm, setFetchedTerm] = useState('');
  const wrapRef = useRef<HTMLFormElement>(null);
  const listId = searchBoxAriaControlsId();
  const statusId = useId();
  const reqRef = useRef(0);
  const shelvesReq = useRef(false);
  const focusedRef = useRef(false);

  useEffect(() => {
    focusedRef.current = focused;
  }, [focused]);

  useEffect(() => {
    setQ(initialQuery);
    // URL/results seed must not reopen the overlay after submit.
    setOpen(false);
    setFocused(false);
    setActive(-1);
  }, [initialQuery]);

  useEffect(() => {
    setHistory(readSearchHistory());
  }, []);

  useEffect(() => {
    api<unknown>('/categories')
      .then((d) => setAllCats(categoriesFromListResponse(d)))
      .catch(() => setAllCats([]));
  }, []);

  function loadHighlights() {
    if (shelvesReq.current) return;
    shelvesReq.current = true;
    api<unknown>('/store/shelves')
      .then((d) => {
        setHighlights(highlightProductsFromShelves(d));
        setActive(-1);
      })
      .catch(() => setHighlights([]));
  }

  function closeSuggestions() {
    setOpen(false);
    setFocused(false);
    setActive(-1);
  }

  useEffect(() => {
    if (!open) return;
    document.documentElement.classList.add(SEARCH_OPEN_CLASS);
    const onTouch = (ev: TouchEvent) => {
      const target = ev.target;
      const list = wrapRef.current?.querySelector('.search-suggest');
      if (target instanceof Node && list?.contains(target)) return;
      ev.preventDefault();
    };
    document.addEventListener('touchmove', onTouch, { passive: false });
    return () => {
      document.documentElement.classList.remove(SEARCH_OPEN_CLASS);
      document.removeEventListener('touchmove', onTouch);
    };
  }, [open]);

  useEffect(() => {
    if (!shouldFetchSuggestions(q)) {
      setProducts([]);
      setLoading(false);
      setActive(-1);
      setFetchedTerm('');
      if (q.trim().length > 0 && !focused) setOpen(false);
      return;
    }
    // Do not fetch/open on /produtos?q= until the shopper focuses the field.
    if (!shouldOpenSuggestionPanel({ focused })) {
      setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = window.setTimeout(() => {
      const seq = ++reqRef.current;
      const term = q.trim();
      api<unknown>(`/products?q=${encodeURIComponent(term)}&pageSize=12`)
        .then((data) => {
          if (seq !== reqRef.current) return;
          setProducts(productsFromListResponse(data));
          setFetchedTerm(term);
          if (shouldOpenSuggestionPanel({ focused: focusedRef.current })) setOpen(true);
          setActive(-1);
        })
        .catch(() => {
          if (seq !== reqRef.current) return;
          setProducts([]);
          setFetchedTerm(term);
          if (shouldOpenSuggestionPanel({ focused: focusedRef.current })) setOpen(true);
          setActive(-1);
        })
        .finally(() => {
          if (seq === reqRef.current) setLoading(false);
        });
    }, SEARCH_SUGGEST_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [q, focused]);

  useEffect(() => {
    function onDoc(ev: MouseEvent) {
      if (!wrapRef.current) return;
      if (ev.target instanceof Node && !wrapRef.current.contains(ev.target)) {
        closeSuggestions();
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const fetching = shouldFetchSuggestions(q);
  const catalogRows: SuggestionRow[] = fetching
    ? buildSuggestionRows({ q, products, categories: allCats, history })
    : [];
  const showHistory = open && shouldShowSearchHistory(q, history.length);
  const hasHits = hasCatalogSuggestionHits(catalogRows);
  const resultsForQuery = fetchedTerm.trim() === q.trim();
  const showEmpty = open && fetching && !loading && resultsForQuery && !hasHits;
  const emptyCopy = showEmpty ? searchEmptyCopy(q.trim(), false) : null;
  const queryEmpty = !(q || '').trim();
  const focusProducts = queryEmpty ? focusTrendingRows(highlights) : [];
  const focusCats = queryEmpty ? focusCategoryShortcuts(allCats, 6) : [];
  const showTrending = shouldShowTrendingHeading(focusProducts.length);
  const showFocus = open && queryEmpty && (showTrending || focusCats.length > 0);
  const showIdleHint = open && queryEmpty && !showHistory && !showFocus;

  const historyRows: PanelItem[] = showHistory
    ? history.map((term, i) => ({
        id: `h-${i}`,
        kind: 'history' as const,
        href: catalogSearchHref(term),
        label: term,
        section: 'history' as const,
      }))
    : [];
  const focusRows: PanelItem[] = showFocus
    ? [
        ...(showTrending
          ? focusProducts.map((row) => ({
              id: row.id,
              kind: row.kind,
              href: row.href,
              label: row.label,
              section: 'trending' as const,
            }))
          : []),
        ...focusCats.map((row) => ({
          id: row.id,
          kind: row.kind,
          href: row.href,
          label: row.label,
          section: 'departments' as const,
        })),
      ]
    : [];

  const navRows: PanelItem[] =
    showHistory || showFocus ? [...historyRows, ...focusRows] : catalogRows.map((row) => ({ ...row }));

  const showList =
    open && (showHistory || showFocus || showIdleHint || (fetching && (loading || catalogRows.length > 0 || showEmpty)));
  const historyStatus = showHistory
    ? `${history.length} busca${history.length === 1 ? '' : 's'} recente${history.length === 1 ? '' : 's'}`
    : '';
  const status =
    showHistory || showFocus
      ? [historyStatus, showTrending ? searchFocusHeading() : '', focusCats.length ? searchDepartmentsHeading() : '']
          .filter(Boolean)
          .join('. ')
      : suggestionsStatusLabel({ q, loading, count: catalogRows.length });

  function go(href: string, opts?: { remember?: string }) {
    if (opts?.remember) {
      setHistory(persistSearchTerm(opts.remember));
    }
    closeSuggestions();
    const next = internalAppPath(href, window.location.origin);
    if (!next) {
      window.location.assign(href);
      return;
    }
    const here = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next === here) return;
    window.scrollTo(0, 0);
    requestNavigationProgress();
    router.push(next);
  }

  function submitTerm() {
    go(catalogSearchHref(q), { remember: q });
  }

  function activateRow(row: PanelItem) {
    if (row.kind === 'history') {
      go(row.href, { remember: row.label });
      return;
    }
    go(row.href, { remember: fetching ? q : undefined });
  }

  function removeHistoryTerm(term: string, ev: { preventDefault(): void; stopPropagation(): void }) {
    ev.preventDefault();
    ev.stopPropagation();
    setHistory(forgetSearchTerm(term));
    setActive(-1);
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
          setFocused(true);
          setQ(e.target.value);
          setActive(-1);
          if (!e.target.value.trim()) {
            setHistory(readSearchHistory());
            setOpen(true);
          }
        }}
        onFocus={() => {
          setFocused(true);
          setHistory(readSearchHistory());
          loadHighlights();
          if (shouldFetchSuggestions(q) && (catalogRows.length > 0 || loading || resultsForQuery)) {
            setOpen(true);
            return;
          }
          if (!q.trim()) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            closeSuggestions();
            return;
          }
          if (!showList || navRows.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setFocused(true);
            setOpen(true);
            setActive((cur) => nextSuggestionIndex(cur, navRows.length, 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setFocused(true);
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
        <IconSearch size={18} />
      </button>
      <p id={statusId} className="sr-only" aria-live="polite">
        {status}
      </p>
      {showList ? (
        <div className="search-suggest">
          {showEmpty && emptyCopy ? (
            <div className="search-suggest-empty" role="status">
              <p className="search-suggest-empty-title">{emptyCopy.title}</p>
              <p className="search-suggest-empty-body">{emptyCopy.body}</p>
            </div>
          ) : null}
          {showIdleHint ? (
            <p className="search-suggest-status">Digite o nome do produto para buscar no catálogo.</p>
          ) : null}
          {loading && !hasHits && !showHistory && !showFocus ? (
            <p className="search-suggest-status">Buscando…</p>
          ) : null}
          {navRows.length > 0 ? (
            <ul id={listId} className="search-suggest-list" role="listbox" aria-label="Sugestões de busca">
              {navRows.map((row, i) => {
                const heading = sectionHeading(row.section);
                const showHead = Boolean(heading) && row.section !== navRows[i - 1]?.section;
                return (
                  <Fragment key={row.id}>
                    {showHead ? (
                      <li role="presentation" className="search-suggest-head">
                        <p className="search-suggest-heading">{heading}</p>
                        {row.section === 'history' ? (
                          <button
                            type="button"
                            className="search-suggest-clear"
                            onClick={() => {
                              setHistory(clearSearchHistory());
                              setActive(-1);
                            }}
                          >
                            {searchHistoryClearLabel()}
                          </button>
                        ) : null}
                      </li>
                    ) : null}
                    <li role="presentation">
                      <div className="search-suggest-line">
                        <button
                          type="button"
                          id={`${listId}-${row.id}`}
                          role="option"
                          aria-selected={i === active}
                          className={`search-suggest-item search-suggest-${row.kind}${i === active ? ' is-active' : ''}`}
                          onMouseEnter={() => setActive(i)}
                          onClick={() => activateRow(row)}
                        >
                          <span className="search-suggest-ico" aria-hidden>
                            {row.kind === 'category' ? (
                              <span className="search-suggest-kind">Depto</span>
                            ) : (
                              <IconSearch size={18} />
                            )}
                          </span>
                          <SuggestLabel label={row.label} q={fetching ? q : ''} />
                          {row.kind === 'history' ? null : (
                            <span className="search-suggest-chevron" aria-hidden>
                              ›
                            </span>
                          )}
                        </button>
                        {row.kind === 'history' ? (
                          <button
                            type="button"
                            className="search-suggest-remove"
                            aria-label={searchHistoryRemoveAria(row.label)}
                            onClick={(e) => removeHistoryTerm(row.label, e)}
                          >
                            ×
                          </button>
                        ) : null}
                      </div>
                    </li>
                  </Fragment>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
