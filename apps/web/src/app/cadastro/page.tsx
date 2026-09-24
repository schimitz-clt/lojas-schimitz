'use client';
import { useEffect, useState } from 'react';
import { api, saveSession } from '@/lib/api';
import { loginNextPath } from '@/lib/order-recovery';
import { CreateAccountFlow } from '@/components/account/CreateAccountFlow';
import { readRegisterFailure, type RegisterBody, type SignupIssue } from '@/lib/signup-flow';

function safeNextPath(): string {
  if (typeof window === 'undefined') return '/conta';
  try {
    const next = new URLSearchParams(window.location.search).get('next');
    if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  } catch {
    /* ignore */
  }
  return '/conta';
}

export default function CadastroPage() {
  const [err, setErr] = useState('');
  const [serverIssue, setServerIssue] = useState<SignupIssue | null>(null);
  const [busy, setBusy] = useState(false);
  const [loginHref, setLoginHref] = useState('/entrar');

  useEffect(() => {
    setLoginHref(loginNextPath(safeNextPath()));
  }, []);

  async function submit(body: RegisterBody) {
    setErr('');
    setServerIssue(null);
    setBusy(true);
    try {
      const data = await api<{ accessToken: string; refreshToken?: string; user: unknown }>(
        '/auth/register',
        { method: 'POST', body: JSON.stringify(body) },
      );
      if (!data?.accessToken || !data.user) {
        setErr('Não foi possível abrir a sessão. Tente entrar.');
        return;
      }
      saveSession(data);
      try {
        localStorage.removeItem('sch_guest');
      } catch {
        /* ignore */
      }
      window.location.href = safeNextPath();
    } catch (e: unknown) {
      const failure = readRegisterFailure(e);
      if (failure.conflict) setServerIssue(failure.conflict);
      else setErr(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="acct-sheet">
      <CreateAccountFlow
        busy={busy}
        error={err}
        serverIssue={serverIssue}
        onEdit={() => {
          setErr('');
          setServerIssue(null);
        }}
        haveAccountHref={loginHref}
        onRegister={submit}
      />
    </div>
  );
}
