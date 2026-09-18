'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, brl } from '@/lib/api';
import {
  compareCell,
  compareEmptyCopy,
  comparePageHeading,
  compareRows,
  mergeCompareSnapshot,
  type CompareSnapshot,
  type ProductCompareLike,
} from '@/lib/product-compare';
import { useCompare } from '@/components/compare/CompareProvider';

export default function CompararClient() {
  const { items, remove, clear } = useCompare();
  const [live, setLive] = useState<CompareSnapshot[]>(items);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedId, setAddedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!items.length) {
      setLive([]);
      setLoading(false);
      setErr('');
      return;
    }
    setLoading(true);
    setErr('');
    Promise.all(
      items.map(async (snap) => {
        try {
          const product = await api<ProductCompareLike>(`/products/${encodeURIComponent(snap.slug)}`);
          return mergeCompareSnapshot(snap, product);
        } catch {
          return snap;
        }
      }),
    )
      .then((next) => {
        if (!cancelled) setLive(next);
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Não foi possível atualizar a comparação.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [items]);

  const heading = comparePageHeading(live.length);
  const empty = compareEmptyCopy();
  const rows = useMemo(() => compareRows(), []);

  async function addToCart(item: CompareSnapshot) {
    if (addingId || (item.stock != null && item.stock <= 0)) return;
    setAddingId(item.id);
    try {
      await api('/cart/items', {
        method: 'POST',
        body: JSON.stringify({ productId: item.id, qty: 1 }),
      });
      setAddedId(item.id);
      try {
        window.dispatchEvent(new Event('sch-cart-updated'));
      } catch {
        /* ignore */
      }
      window.setTimeout(() => setAddedId((cur) => (cur === item.id ? null : cur)), 1800);
    } catch {
      window.location.href = `/produto/${item.slug}`;
    } finally {
      setAddingId(null);
    }
  }

  return (
    <div className="compare-page" style={{ padding: '18px 0 28px' }}>
      <p className="sf-catalog-kicker">Vitrine</p>
      <h1 className="sf-catalog-title">{heading.title}</h1>
      <p className="sf-catalog-sub muted">{heading.subtitle}</p>
      {loading ? (
        <p className="muted" style={{ marginTop: 0 }}>
          Atualizando preços e estoque do catálogo…
        </p>
      ) : null}
      {err ? <div className="alert">{err}</div> : null}

      {!live.length ? (
        <div className="catalog-empty sf-catalog-empty">
          <p className="sf-catalog-empty-title">{empty.title}</p>
          <p className="muted sf-catalog-empty-body">{empty.body}</p>
          <div className="sf-catalog-empty-actions">
            <Link className="btn" href="/produtos">
              Ver catálogo
            </Link>
            <Link className="btn ghost" href="/">
              Voltar ao início
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="compare-toolbar">
            <Link className="btn ghost" href="/produtos">
              Adicionar outro
            </Link>
            <button type="button" className="btn ghost" onClick={clear}>
              Limpar comparação
            </button>
          </div>

          <div className="compare-table-wrap">
            <table className="compare-table">
              <thead>
                <tr>
                  <th scope="col">Detalhe</th>
                  {live.map((item) => (
                    <th key={item.id} scope="col">
                      <Link href={`/produto/${item.slug}`} className="compare-head">
                        {item.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.image} alt="" width={120} height={120} />
                        ) : (
                          <span className="compare-head-ph">Imagem em breve</span>
                        )}
                        <span className="compare-head-name">{item.name}</span>
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">{row.label}</th>
                    {live.map((item) => (
                      <td
                        key={`${item.id}-${row.id}`}
                        className={row.id === 'pix' ? 'compare-cell-pix' : undefined}
                      >
                        {compareCell(item, row.id)}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <th scope="row">Ações</th>
                  {live.map((item) => {
                    const out = item.stock != null && item.stock <= 0;
                    return (
                      <td key={`${item.id}-actions`}>
                        <div className="compare-actions">
                          <Link className="btn ghost" href={`/produto/${item.slug}`}>
                            Ver produto
                          </Link>
                          <button
                            type="button"
                            className="btn"
                            disabled={out || addingId === item.id}
                            onClick={() => addToCart(item)}
                          >
                            {out
                              ? 'Indisponível'
                              : addingId === item.id
                                ? 'Adicionando…'
                                : addedId === item.id
                                  ? '✓ Na sacola'
                                  : 'Adicionar'}
                          </button>
                          <button type="button" className="btn ghost" onClick={() => remove(item.id)}>
                            Remover
                          </button>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          <ul className="compare-cards" aria-label="Comparação no celular">
            {live.map((item) => {
              const out = item.stock != null && item.stock <= 0;
              return (
                <li key={`m-${item.id}`} className="compare-card">
                  <Link href={`/produto/${item.slug}`} className="compare-card-head">
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image} alt="" width={88} height={88} />
                    ) : null}
                    <span>
                      <strong>{item.name}</strong>
                      <span className="compare-cell-pix">{brl(item.price > 0 ? item.price : 0)}</span>
                    </span>
                  </Link>
                  <dl>
                    {rows.map((row) => (
                      <div key={row.id}>
                        <dt>{row.label}</dt>
                        <dd className={row.id === 'pix' ? 'compare-cell-pix' : undefined}>
                          {compareCell(item, row.id)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <div className="compare-actions">
                    <Link className="btn ghost" href={`/produto/${item.slug}`}>
                      Ver produto
                    </Link>
                    <button
                      type="button"
                      className="btn"
                      disabled={out || addingId === item.id}
                      onClick={() => addToCart(item)}
                    >
                      {out
                        ? 'Indisponível'
                        : addingId === item.id
                          ? 'Adicionando…'
                          : addedId === item.id
                            ? '✓ Na sacola'
                            : 'Adicionar'}
                    </button>
                    <button type="button" className="btn ghost" onClick={() => remove(item.id)}>
                      Remover
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
