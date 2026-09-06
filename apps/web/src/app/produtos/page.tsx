'use client';

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ProductCard, Product } from '@/components/ProductCard';

type Category = { id: string; name: string; slug: string };
type ListResponse = { items: Product[]; total?: number; page?: number; pageSize?: number; sort?: string };

const SORTS: { value: string; label: string }[] = [
  { value: 'relevance', label: 'Relevância' },
  { value: 'price_asc', label: 'Menor preço' },
  { value: 'price_desc', label: 'Maior preço' },
  { value: 'newest', label: 'Mais recentes' },
];

function ProdutosInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const q = sp.get('q') || '';
  const category = sp.get('category') || '';
  const minPrice = sp.get('minPrice') || '';
  const maxPrice = sp.get('maxPrice') || '';
  const sort = sp.get('sort') || 'relevance';

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const [draftMin, setDraftMin] = useState(minPrice);
  const [draftMax, setDraftMax] = useState(maxPrice);

  useEffect(() => {
    setDraftMin(minPrice);
    setDraftMax(maxPrice);
  }, [minPrice, maxPrice]);

  useEffect(() => {
    api<Category[]>('/categories')
      .then((d) => setCategories(Array.isArray(d) ? d : []))
      .catch(() => setCategories([]));
  }, []);

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

  function applyPrice(e: { preventDefault(): void }) {
    e.preventDefault();
    pushFilters({ minPrice: draftMin.trim(), maxPrice: draftMax.trim() });
  }

  function clearFilters() {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    const qs = params.toString();
    router.push(qs ? `/produtos?${qs}` : '/produtos');
  }

  const hasExtraFilters = Boolean(category || minPrice || maxPrice || (sort && sort !== 'relevance'));

  return (
    <div style={{ padding: '22px 0' }}>
      <h1>Produtos</h1>
      <p className="muted" style={{ marginBottom: 14 }}>
        Catálogo Lojas Schimitz
        {q ? <> · buscando “{q}”</> : null}
        {!loading && !err ? <> · {total} resultado{total === 1 ? '' : 's'}</> : null}.
      </p>

      <div className="catalog-toolbar">
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
        <label className="catalog-field">
          Ordenar
          <select
            value={sort}
            onChange={(e) => pushFilters({ sort: e.target.value })}
            aria-label="Ordenar produtos"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <form className="catalog-price" onSubmit={applyPrice}>
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
            Filtrar
          </button>
        </form>
        {hasExtraFilters ? (
          <button className="btn ghost" type="button" onClick={clearFilters}>
            Limpar filtros
          </button>
        ) : null}
      </div>

      <p style={{ marginBottom: 18, display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 14 }}>
        <Link href="/">Início</Link>
        <span className="muted">·</span>
        <Link href="/departamento/ofertas">Ofertas</Link>
        <span className="muted">·</span>
        <Link href="/departamento/eletro">Eletro</Link>
        <span className="muted">·</span>
        <Link href="/departamento/celulares">Celulares</Link>
        <span className="muted">·</span>
        <Link href="/marketplace">Marketplace</Link>
        <span className="muted">·</span>
        <Link href="/suporte">Suporte</Link>
      </p>

      {err ? <div className="alert">{err}</div> : null}
      {loading ? <p className="muted">Carregando produtos…</p> : null}
      {!loading && !err && products.length === 0 ? (
        <div className="catalog-empty">
          <p style={{ margin: 0, fontWeight: 700 }}>
            {q
              ? `Não encontramos resultados para “${q}”.`
              : 'Nenhum produto encontrado com esses filtros.'}
          </p>
          <p className="muted" style={{ margin: '8px 0 0' }}>
            Tente outro termo, remova filtros ou explore os{' '}
            <Link href="/departamento/ofertas">departamentos</Link> e o{' '}
            <Link href="/marketplace">marketplace</Link>.
          </p>
        </div>
      ) : null}
      <div className="grid">
        {products.map((p) => (
          <ProductCard key={p.id} p={p} />
        ))}
      </div>
    </div>
  );
}

export default function ProdutosPage() {
  return (
    <Suspense fallback={<p className="muted">Carregando…</p>}>
      <ProdutosInner />
    </Suspense>
  );
}
