'use client';
import { useEffect, useState } from 'react';
import { api, saveSession } from '@/lib/api';
import { loginNextPath } from '@/lib/order-recovery';
import { CreateAccountFlow } from '@/components/account/CreateAccountFlow';
import { postRegisterPath, type RegisterBody } from '@/lib/signup-flow';

function loginHrefFromLocation(): string {
  if (typeof window === 'undefined') return '/entrar';
  try {
    const next = new URLSearchParams(window.location.search).get('next');
    if (next && next.startsWith('/') && !next.startsWith('//')) return loginNextPath(next);
  } catch {
    /* ignore */
  }
  return '/entrar';
}

export default function CadastroPage() {
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [loginHref, setLoginHref] = useState('/entrar');

  useEffect(() => {
    setLoginHref(loginHrefFromLocation());
  }, []);

  async function submit(body: RegisterBody) {
    setErr('');
    setBusy(true);
    try {
      const data = await api<{ accessToken: string; refreshToken?: string; user: unknown }>(
        '/auth/register',
        {
          method: 'POST',
          body: JSON.stringify(body),
        },
      );
      saveSession(data);
      try {
        localStorage.removeItem('sch_guest');
      } catch {
        /* ignore */
      }
      window.location.href = postRegisterPath(window.location.search);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Não foi possível cadastrar');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="acct-sheet">
      <CreateAccountFlow
        busy={busy}
        error={err}
        onEdit={() => setErr('')}
        haveAccountHref={loginHref}
        onRegister={submit}
      />
    </div>
  );
}
