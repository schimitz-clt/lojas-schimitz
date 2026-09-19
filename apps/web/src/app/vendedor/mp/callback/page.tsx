'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, isUnauthorizedError } from '@/lib/api';
import { loginNextPath } from '@/lib/order-recovery';

export default function VendedorMpCallbackPage() {
  const router = useRouter();
  const [msg, setMsg] = useState('Conectando Mercado Pago…');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    const code = params.get('code') || '';
    const state = params.get('state') || '';
    if (error) {
      router.replace('/vendedor?mp=denied');
      return;
    }
    if (!code || !state) {
      router.replace('/vendedor?mp=error');
      return;
    }
    api('/seller/mp/callback', {
      method: 'POST',
      body: JSON.stringify({ code, state }),
    })
      .then(() => {
        router.replace('/vendedor?mp=ok');
      })
      .catch((e: unknown) => {
        if (isUnauthorizedError(e)) {
          window.location.href = loginNextPath('/vendedor');
          return;
        }
        setMsg(e instanceof Error ? e.message : 'Falha ao conectar Mercado Pago');
        router.replace('/vendedor?mp=error');
      });
  }, [router]);

  return (
    <div style={{ padding: '24px 0' }}>
      <p className="muted">{msg}</p>
    </div>
  );
}
