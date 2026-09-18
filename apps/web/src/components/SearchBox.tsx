'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { api } from '@/lib/api';
import {
  SEARCH_SUGGEST_DEBOUNCE_MS,
  buildSuggestionRows,
  catalogSearchHref,
  categoriesFromListResponse,
  nextSuggestionIndex,
  productsFromListResponse,
  searchBoxAriaControlsId,
  shouldFetchSuggestions,
  suggestionsStatusLabel,
  type SearchCategoryLike,
  type SearchProductLike,
  type SuggestionRow,
} from '@/lib/search-suggestions';

type Props = {
  initialQuery?: string;
};

export function SearchBox({ initialQuery = '' }: Props) {
  const [q, setQ] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<SearchProductLike[]>([]);
  const [allCats, setAllCats] = useState<SearchCategoryLike[]>([]);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLFormElement>(null);
  const listId = searchBoxAriaControlsId();
  const statusId = useId();
  const reqRef = useRef(0);

  useEffect(() => {
    setQ(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    api<unknown>('/categories')
      .then((d) => setAllCats(categoriesFromListResponse(d)))
      .catch(() => setAllCats([]));
  }, []);

  useEffect(() => {
    if (!shouldFetchSuggestions(q)) {
      setProducts([]);
      setOpen(false);
      setLoading(false);
      setActive(-1);
      return;
    }
    const handle = window.setTimeout(() => {
      const seq = ++reqRef.current;
      setLoading(true);
      const term = q.trim();
      api<unknown>(`/products?q=${encodeURIComponent(term)}&pageSize=8`)
        .then((data) => {
          if (seq !== reqRef.current) return;
          setProducts(productsFromListResponse(data));
          setOpen(true);
          setActive(-1);
        })
        .catch(() => {
          if (seq !== reqRef.current) return;
          setProducts([]);
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

  const rows: SuggestionRow[] = shouldFetchSuggestions(q)
    ? buildSuggestionRows({ q, products, categories: allCats })
    : [];
  const showList = open && shouldFetchSuggestions(q) && (loading || rows.length > 0);
  const status = suggestionsStatusLabel({ q, loading, count: rows.length });

  function go(href: string) {
    setOpen(false);
    window.location.href = href;
  }

  function submitTerm() {
    go(catalogSearchHref(q));
  }

  return (
    <form
      ref={wrapRef}
      className="search"
      action="/produtos"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (active >= 0 && rows[active]) {
          go(rows[active].href);
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
        }}
        onFocus={() => {
          if (shouldFetchSuggestions(q) && rows.length > 0) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
            setActive(-1);
            return;
          }
          if (!showList || rows.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActive((cur) => nextSuggestionIndex(cur, rows.length, 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setOpen(true);
            setActive((cur) => nextSuggestionIndex(cur, rows.length, -1));
          }
        }}
        aria-label="Buscar produtos"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={active >= 0 && rows[active] ? `${listId}-${rows[active].id}` : undefined}
        autoComplete="off"
      />
      <button type="submit" className="search-submit" aria-label="Buscar">
        🔍
      </button>
      <p id={statusId} className="sr-only" aria-live="polite">
        {status}
      </p>
      {showList ? (
        <ul id={listId} className="search-suggest" role="listbox" aria-label="Sugestões de busca">
          {loading && rows.length === 0 ? (
            <li className="search-suggest-status" role="presentation">
              Buscando…
            </li>
          ) : null}
          {rows.map((row, i) => (
            <li key={row.id} role="presentation">
              <button
                type="button"
                id={`${listId}-${row.id}`}
                role="option"
                aria-selected={i === active}
                className={`search-suggest-item search-suggest-${row.kind}${i === active ? ' is-active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(row.href)}
              >
                <span className="search-suggest-kind">
                  {row.kind === 'category' ? 'Depto' : row.kind === 'all' ? 'Busca' : 'Produto'}
                </span>
                <span className="search-suggest-copy">
                  <span className="search-suggest-label">{row.label}</span>
                  {row.sub ? <span className="search-suggest-sub">{row.sub}</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
