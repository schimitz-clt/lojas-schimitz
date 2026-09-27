'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/lib/client-error-report';

/** H4 — last-resort boundary (errors in the root layout itself). Must render its own <html>/<body>. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError('global-boundary', error, { digest: error.digest });
  }, [error]);

  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '48px 20px', textAlign: 'center', color: '#07122A' }}>
        <h1 style={{ fontSize: 24, marginBottom: 12 }}>Algo deu errado</h1>
        <p style={{ marginBottom: 24 }}>Já fomos avisados. Tente de novo em instantes.</p>
        <button
          type="button"
          onClick={() => reset()}
          style={{ padding: '12px 20px', borderRadius: 8, border: 0, background: '#07122A', color: '#fff', cursor: 'pointer' }}
        >
          Tentar de novo
        </button>
        <p style={{ marginTop: 16 }}>
          <a href="/" style={{ color: '#07122A' }}>
            Ir para o início
          </a>
        </p>
      </body>
    </html>
  );
}
