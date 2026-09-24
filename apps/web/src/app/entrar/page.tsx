'use client';
import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { api, saveSession } from '@/lib/api';
import { authPageModeFromSearch } from '@/lib/checkout-auth';
import { CreateAccountFlow } from '@/components/account/CreateAccountFlow';
import { postRegisterPath, type RegisterBody } from '@/lib/signup-flow';

function safeNextPath(): string {
  if (typeof window === 'undefined') return '/conta';
  return postRegisterPath(window.location.search);
}

export default function EntrarPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [nextPath, setNextPath] = useState('/conta');

  useEffect(() => {
    setMode(authPageModeFromSearch(window.location.search));
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

  async function submitLogin(e: FormEvent) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const data = await api<{ accessToken: string; refreshToken?: string; user: unknown }>(
        '/auth/login',
        { method: 'POST', body: JSON.stringify({ email, password }) },
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
    setBusy(true);
    try {
      const data = await api<{ accessToken: string; refreshToken?: string; user: unknown }>(
        '/auth/register',
        { method: 'POST', body: JSON.stringify(body) },
      );
      await finishLogin(data);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Não foi possível cadastrar');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="acct-sheet">
      {atCheckout ? (
        <p className="acct-lead">
          Entre ou crie a conta agora para finalizar. Depois a sessão fica salva neste aparelho.
        </p>
      ) : null}
      <div className="acct-tabs" role="tablist" aria-label="Conta">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'login'}
          className={mode === 'login' ? 'acct-tab is-on' : 'acct-tab'}
          disabled={busy}
          onClick={() => {
            setMode('login');
            setErr('');
          }}
        >
          Entrar
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'register'}
          className={mode === 'register' ? 'acct-tab is-on' : 'acct-tab'}
          disabled={busy}
          onClick={() => {
            setMode('register');
            setErr('');
          }}
        >
          Criar conta
        </button>
      </div>
      {mode === 'login' ? (
        <form className="acct-form" onSubmit={submitLogin}>
          <h1 className="acct-title">Entrar</h1>
          <span className="acct-kicker" aria-hidden />
          {err ? (
            <div className="alert" role="alert">
              {err}
            </div>
          ) : null}
          <div className="acct-field">
            <label className="acct-label" htmlFor="login-email">
              E-mail
            </label>
            <input
              id="login-email"
              name="email"
              className="acct-line"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="acct-field">
            <label className="acct-label" htmlFor="login-password">
              Senha
            </label>
            <input
              id="login-password"
              name="password"
              className="acct-line"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="acct-cta" type="submit" disabled={busy}>
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
          <Link className="acct-textlink" href="/esqueci-senha">
            Esqueci minha senha
          </Link>
        </form>
      ) : (
        <CreateAccountFlow
          busy={busy}
          error={err}
          onEdit={() => setErr('')}
          onHaveAccount={() => {
            setMode('login');
            setErr('');
          }}
          onRegister={submitRegister}
        />
      )}
    </div>
  );
}
