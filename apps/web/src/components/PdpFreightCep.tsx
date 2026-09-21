'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  formatCepInput,
  isCompleteCep,
  persistStoredCep,
  pdpFreightCheckoutFallback,
  pdpFreightDestinationLine,
  pdpFreightEstimateRow,
  pdpFreightIdleCopy,
  readStoredCep,
  type PdpFreightQuote,
} from '@/lib/pdp-trust';

type Props = {
  /** Product list price — same subtotal the checkout quote uses for a 1-item bag. */
  subtotal: number;
};

export function PdpFreightCep({ subtotal }: Props) {
  const idle = pdpFreightIdleCopy();
  const [cep, setCep] = useState('');
  const [quote, setQuote] = useState<PdpFreightQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const saved = readStoredCep(typeof window !== 'undefined' ? window.localStorage : null);
    setCep(saved);
    if (isCompleteCep(saved)) void quoteCep(saved);
    // quote once per product price when a saved CEP exists (same key as header).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]);

  async function quoteCep(raw: string) {
    const next = persistStoredCep(raw, typeof window !== 'undefined' ? window.localStorage : null);
    setCep(next);
    if (!isCompleteCep(next)) {
      setQuote(null);
      setFailed(false);
      return;
    }
    setLoading(true);
    setFailed(false);
    try {
      const data = await api<PdpFreightQuote>('/shipping/quote', {
        method: 'POST',
        body: JSON.stringify({ cep: next, subtotal: Math.max(0, Number(subtotal) || 0) }),
      });
      setQuote(data);
      setEditing(false);
    } catch {
      setQuote(null);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    void quoteCep(cep);
  }

  const estimate = quote ? pdpFreightEstimateRow(quote) : null;
  const fallback = pdpFreightCheckoutFallback();
  const showForm = editing || !isCompleteCep(cep);

  return (
    <div className="pdp-freight" aria-label="Calcular frete">
      {showForm ? (
        <div className="pdp-freight-top">
          <p className="pdp-freight-kicker">{idle.title}</p>
          <form className="pdp-freight-form" onSubmit={onSubmit}>
            <label className="pdp-freight-field">
              <span className="sr-only">CEP</span>
              <input
                inputMode="numeric"
                autoComplete="postal-code"
                placeholder="00000-000"
                value={cep}
                onChange={(e) => {
                  setCep(formatCepInput(e.target.value));
                  setFailed(false);
                  setQuote(null);
                }}
                aria-label="Informe seu CEP"
              />
            </label>
            <button className="btn" type="submit" disabled={loading || !isCompleteCep(cep)}>
              {loading ? 'Calculando…' : 'Calcular'}
            </button>
          </form>
        </div>
      ) : (
        <div className="pdp-freight-dest">
          <p className="pdp-freight-dest-line">{pdpFreightDestinationLine(cep, quote?.label)}</p>
          <button type="button" className="pdp-freight-alter" onClick={() => setEditing(true)}>
            alterar
          </button>
        </div>
      )}
      {showForm ? <p className="muted pdp-freight-hint">{idle.body}</p> : null}
      {loading ? <p className="muted pdp-freight-status">Consultando a entrega própria…</p> : null}
      {!loading && estimate && !showForm ? (
        <p className="pdp-freight-result pdp-freight-estimate" role="status">
          <span className="pdp-freight-eta">
            <span className="pdp-freight-receive">Receba </span>
            {estimate.eta}
            <span className="muted pdp-freight-note">{estimate.note}</span>
          </span>
          <strong>{estimate.price}</strong>
        </p>
      ) : null}
      {!loading && failed && !showForm ? (
        <p className="pdp-freight-fallback" role="status">
          <strong>{fallback.title}</strong>
          <span className="muted">
            {fallback.body}{' '}
            <Link href="/carrinho">Ir ao checkout</Link>
          </span>
        </p>
      ) : null}
    </div>
  );
}
