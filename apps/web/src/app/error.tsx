'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { reportClientError } from '@/lib/client-error-report';

/**
 * H4 — route error boundary. Before this file Next showed its default English error screen and
 * nothing was reported. Now: friendly PT-BR message + retry, and the error goes to the API logs
 * (WEB_CLIENT_ERROR, masked). `digest` links it to the server log line (WEB_SERVER_ERROR).
 */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError('boundary', error, { digest: error.digest });
  }, [error]);

  return (
    <section className="not-found" aria-labelledby="route-error-title">
      <p className="not-found-kicker">Ops</p>
      <h1 id="route-error-title">Algo deu errado nesta página</h1>
      <p>Já fomos avisados. Tente de novo; se continuar, volte para o início ou fale com a gente no WhatsApp.</p>
      <div className="not-found-actions">
        <button type="button" className="btn" onClick={() => reset()}>
          Tentar de novo
        </button>
        <Link className="btn ghost" href="/">
          Ir para o início
        </Link>
      </div>
    </section>
  );
}
