'use client';
import { useEffect, useState } from 'react';
import { api, saveSession } from '@/lib/api';
import { authPageModeFromSearch } from '@/lib/checkout-auth';
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

export default function EntrarPage() {
  /**
   * E-mail first (Magalu-style): one e-mail field; the server says whether the account exists.
   * Existing → password (login or reset). New → the 3-step signup. `?cadastro=1` opens the signup
   * wording directly ("Criar conta" links from /conta keep working).
   */
  const [mode, setMode] = useState<'identify' | 'register'>('identify');
  const [err, setErr] = useState('');
  const [serverIssue, setServerIssue] = useState<SignupIssue | null>(null);
  const [busy, setBusy] = useState(false);
  const [nextPath, setNextPath] = useState('/conta');

  useEffect(() => {
    setMode(authPageModeFromSearch(window.location.search) === 'register' ? 'register' : 'identify');
    setNextPath(safeNextPath());
  }, []);

  const atCheckout = nextPath === '/checkout' || nextPath.startsWith('/checkout');

  async function finishLogin(data: { accessToken: string; refreshToken?: string; user: unknown }) {
    saveSession(data);
    try {
      localStorage.removeItem('sch_guest');
    } catch {
      /* ignore */
    }
    window.location.href = safeNextPath();
  }

  async function lookupSignupEmail(email: string) {
    const data = await api<{ exists: boolean }>('/auth/signup-email', {
      method: 'POST',
      body: JSON.stringify({ email: signupEmailForApi(email) }),
    });
    return readSignupEmailExists(data);
  }

  async function lookupSignupCpf(cpf: string) {
    const data = await api<unknown>('/auth/signup-cpf', {
      method: 'POST',
      body: JSON.stringify({ cpf: cpfDigits(cpf) }),
    });
    return readSignupCpfMatch(data);
  }

  async function signInExisting(input: { email: string; password: string }) {
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
      await finishLogin(data);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Não foi possível entrar');
    } finally {
      setBusy(false);
    }
  }

  async function signInExistingCpf(input: { cpf: string; password: string }) {
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
      await finishLogin(data);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Não foi possível entrar');
    } finally {
      setBusy(false);
    }
  }

  async function submitRegister(body: RegisterBody) {
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
      await finishLogin(data);
    } catch (e: unknown) {
      const failure = readRegisterFailure(e);
      if (failure.conflict) setServerIssue(failure.conflict);
      else setErr(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="acct-sheet" data-auth-entry={mode}>
      {atCheckout ? (
        <p className="acct-lead">
          Entre ou crie a conta agora para finalizar. Depois a sessão fica salva neste aparelho.
        </p>
      ) : null}
      <CreateAccountFlow
        key={mode}
        entry={mode === 'register' ? 'signup' : 'identify'}
        busy={busy}
        error={err}
        serverIssue={serverIssue}
        onEdit={() => {
          setErr('');
          setServerIssue(null);
        }}
        onHaveAccount={
          mode === 'register'
            ? () => {
                setMode('identify');
                setErr('');
                setServerIssue(null);
              }
            : undefined
        }
        onLookupEmail={lookupSignupEmail}
        onLookupCpf={lookupSignupCpf}
        onSignIn={signInExisting}
        onSignInCpf={signInExistingCpf}
        onRegister={submitRegister}
      />
    </div>
  );
}
