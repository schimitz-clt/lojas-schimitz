'use client';

import { Fragment, useEffect, useId, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { productCardAddLabel } from '@/lib/product-card-cues';
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
  focusFallbackShortcuts,
  focusHighlightRows,
  hasCatalogSuggestionHits,
  highlightProductsFromShelves,
  nextSuggestionIndex,
  productsFromListResponse,
  searchBoxAriaControlsId,
  searchFocusHeading,
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
  productId?: string;
  canAdd?: boolean;
  external?: boolean;
};

function kindLabel(kind: PanelKind): string | null {
  if (kind === 'category') return 'Depto';
  if (kind === 'all') return 'Busca';
  if (kind === 'history') return '↻';
  if (kind === 'shortcut') return '→';
  return null;
}

export function SearchBox({ initialQuery = '' }: Props) {
  const [q, setQ] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<SearchProductLike[]>([]);
  const [allCats, setAllCats] = useState<SearchCategoryLike[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [highlights, setHighlights] = useState<SearchProductLike[]>([]);
  const [active, setActive] = useState(-1);
  const [fetchedTerm, setFetchedTerm] = useState('');
  const [bagId, setBagId] = useState<string | null>(null);
  const [bagOk, setBagOk] = useState<string | null>(null);
  const wrapRef = useRef<HTMLFormElement>(null);
  const listId = searchBoxAriaControlsId();
  const statusId = useId();
  const reqRef = useRef(0);
  const shelvesReq = useRef(false);

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
  const queryEmpty = !(q || '').trim();
  const focusProducts = queryEmpty ? focusHighlightRows(highlights) : [];
  const shortcutLimit = focusProducts.length > 0 ? 4 : 6;
  const focusCats = queryEmpty ? focusCategoryShortcuts(allCats, shortcutLimit) : [];
  const focusFallback =
    queryEmpty && focusCats.length === 0 ? focusFallbackShortcuts(emptySearchSuggestions(), shortcutLimit) : [];
  const showFocus = open && queryEmpty && (focusProducts.length > 0 || focusCats.length > 0 || focusFallback.length > 0);

  const historyRows: PanelItem[] = showHistory
    ? history.map((term, i) => ({
        id: `h-${i}`,
        kind: 'history' as const,
        href: catalogSearchHref(term),
        label: term,
      }))
    : [];
  const focusRows: PanelItem[] = showFocus
    ? [
        ...focusProducts.map((row) => ({ ...row })),
        ...focusCats.map((row) => ({ ...row })),
        ...focusFallback.map((s) => ({
          id: s.id,
          kind: 'shortcut' as const,
          href: s.href,
          label: s.label,
        })),
      ]
    : [];

  const navRows: PanelItem[] =
    showHistory || showFocus
      ? [...historyRows, ...focusRows]
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
      showFocus ||
      (fetching && (loading || catalogRows.length > 0 || showEmpty)));
  const historyStatus = showHistory
    ? `${history.length} busca${history.length === 1 ? '' : 's'} recente${history.length === 1 ? '' : 's'}`
    : '';
  const status =
    showHistory || showFocus
      ? [historyStatus, showFocus ? searchFocusHeading() : ''].filter(Boolean).join('. ')
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

  function removeHistoryTerm(term: string, ev: { preventDefault(): void; stopPropagation(): void }) {
    ev.preventDefault();
    ev.stopPropagation();
    setHistory(forgetSearchTerm(term));
    setActive(-1);
  }

  async function addSuggestionToBag(row: PanelItem, ev: { preventDefault(): void; stopPropagation(): void }) {
    ev.preventDefault();
    ev.stopPropagation();
    const id = row.productId;
    if (!id || !row.canAdd || bagId) return;
    setBagId(id);
    try {
      await api('/cart/items', {
        method: 'POST',
        body: JSON.stringify({ productId: id, qty: 1 }),
      });
      setBagOk(id);
      try {
        window.dispatchEvent(new Event('sch-cart-updated'));
      } catch {
        /* ignore */
      }
      window.setTimeout(() => setBagOk((cur) => (cur === id ? null : cur)), 1800);
    } catch {
      window.location.href = row.href;
    } finally {
      setBagId(null);
    }
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
          loadHighlights();
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
            {navRows.map((row, i) => {
              const focusStart = showHistory ? history.length : 0;
              const showBag = row.kind === 'product' && Boolean(row.canAdd && row.productId);
              return (
                <Fragment key={row.id}>
                  {i === 0 && showHistory ? (
                    <li role="presentation" className="search-suggest-head">
                      <p className="search-suggest-heading">{searchHistoryHeading()}</p>
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
                    </li>
                  ) : null}
                  {i === focusStart && showFocus ? (
                    <li role="presentation" className="search-suggest-head">
                      <p className="search-suggest-heading">{searchFocusHeading()}</p>
                    </li>
                  ) : null}
                  <li role="presentation">
                    <div className={`search-suggest-line${showBag ? ' has-bag' : ''}`}>
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
                        ) : row.kind === 'history' || row.kind === 'shortcut' ? (
                          <span className={`search-suggest-kind search-suggest-kind-${row.kind}`} aria-hidden />
                        ) : (
                          <span className="search-suggest-kind">{kindLabel(row.kind)}</span>
                        )}
                        <span className="search-suggest-copy">
                          <span className="search-suggest-label">{row.label}</span>
                          {row.kind === 'product' && (row.pixLabel || row.priceLabel) ? (
                            <span className="search-suggest-prices">
                              {row.pixLabel ? (
                                <span className="search-suggest-pix search-suggest-pix-lead">
                                  {row.pixLabel}
                                  {row.pixTag ? (
                                    <span className="search-suggest-pix-tag">{row.pixTag}</span>
                                  ) : null}
                                </span>
                              ) : null}
                              {row.priceLabel ? (
                                <span className="search-suggest-price">
                                  {row.pixLabel ? 'ou ' : ''}
                                  {row.priceLabel}
                                </span>
                              ) : null}
                            </span>
                          ) : row.sub ? (
                            <span className="search-suggest-sub">{row.sub}</span>
                          ) : null}
                        </span>
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
                      {showBag ? (
                        <button
                          type="button"
                          className={`search-suggest-bag${bagOk === row.productId ? ' is-added' : ''}`}
                          onClick={(e) => addSuggestionToBag(row, e)}
                          disabled={bagId === row.productId}
                        >
                          {productCardAddLabel({
                            outOfStock: false,
                            adding: bagId === row.productId,
                            added: bagOk === row.productId,
                          })}
                        </button>
                      ) : null}
                    </div>
                  </li>
                </Fragment>
              );
            })}
          </ul>
        </div>
      ) : null}
    </form>
  );
}
