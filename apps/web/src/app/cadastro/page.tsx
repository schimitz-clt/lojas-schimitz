'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { loginNextPath } from '@/lib/order-recovery';
import { CreateAccountFlow } from '@/components/account/CreateAccountFlow';
import type { RegisterBody } from '@/lib/signup-flow';

const REGISTER_ACCEPTED_FALLBACK =
  'Se o e-mail ainda não estiver cadastrado, sua conta foi criada. Faça login para continuar.';

function safeNextPath(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const next = new URLSearchParams(window.location.search).get('next');
    if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  } catch {
    /* ignore */
  }
  return null;
}

export default function CadastroPage() {
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loginHref, setLoginHref] = useState('/entrar');

  useEffect(() => {
    const next = safeNextPath();
    setLoginHref(next ? loginNextPath(next) : '/entrar');
  }, []);

  async function submit(body: RegisterBody) {
    setErr('');
    setMsg('');
    setBusy(true);
    try {
      const data = await api<{ accepted?: boolean; message?: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      try {
        localStorage.removeItem('sch_guest');
      } catch {
        /* ignore */
      }
      setDone(true);
      setMsg(data.message || REGISTER_ACCEPTED_FALLBACK);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Não foi possível cadastrar');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="acct-sheet">
        <p className="acct-step">Cadastro</p>
        <h1 className="acct-title">Criar meu cadastro</h1>
        <span className="acct-kicker" aria-hidden />
        <div className="ok" role="status">
          {msg}
        </div>
        <Link className="acct-cta" href={loginHref}>
          Entrar para continuar
        </Link>
      </div>
    );
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
