'use client';
import { useEffect, useState } from 'react';
import { api, saveSession } from '@/lib/api';
import { loginNextPath } from '@/lib/order-recovery';
import { CreateAccountFlow } from '@/components/account/CreateAccountFlow';
import {
  cpfDigits,
  readRegisterFailure,
  readSignupCpfMatch,
  readSignupEmailExists,
  signupEmailForApi,
  type RegisterBody,
  type SignupIssue,
} from '@/lib/signup-flow';

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

  function finishSession(data: { accessToken: string; refreshToken?: string; user: unknown } | null) {
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
  }

  async function lookupEmail(email: string) {
    const data = await api<{ exists: boolean }>('/auth/signup-email', {
      method: 'POST',
      body: JSON.stringify({ email: signupEmailForApi(email) }),
    });
    return readSignupEmailExists(data);
  }

  async function lookupCpf(cpf: string) {
    const data = await api<unknown>('/auth/signup-cpf', {
      method: 'POST',
      body: JSON.stringify({ cpf: cpfDigits(cpf) }),
    });
    return readSignupCpfMatch(data);
  }

  async function signIn(input: { email: string; password: string }) {
    setErr('');
    setServerIssue(null);
    setBusy(true);
    try {
      const data = await api<{ accessToken: string; refreshToken?: string; user: unknown }>(
        '/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ email: signupEmailForApi(input.email), password: input.password }),
        },
      );
      finishSession(data);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Não foi possível entrar');
    } finally {
      setBusy(false);
    }
  }

  async function signInCpf(input: { cpf: string; password: string }) {
    setErr('');
    setServerIssue(null);
    setBusy(true);
    try {
      const data = await api<{ accessToken: string; refreshToken?: string; user: unknown }>(
        '/auth/login-cpf',
        {
          method: 'POST',
          body: JSON.stringify({ cpf: cpfDigits(input.cpf), password: input.password }),
        },
      );
      finishSession(data);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Não foi possível entrar');
    } finally {
      setBusy(false);
    }
  }

  async function submit(body: RegisterBody) {
    setErr('');
    setServerIssue(null);
    setBusy(true);
    try {
      const data = await api<{ accessToken: string; refreshToken?: string; user: unknown }>(
        '/auth/register',
        { method: 'POST', body: JSON.stringify(body) },
      );
      finishSession(data);
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
        onLookupEmail={lookupEmail}
        onLookupCpf={lookupCpf}
        onSignIn={signIn}
        onSignInCpf={signInCpf}
        onRegister={submit}
      />
    </div>
  );
}
