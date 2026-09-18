'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, saveSession } from '@/lib/api';
import { authPageModeFromSearch } from '@/lib/checkout-auth';

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

const REGISTER_LOGIN_FAIL =
  'Não foi possível entrar. Se você já tem conta, use a senha cadastrada.';

export default function EntrarPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
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

  async function submitLogin(e: React.FormEvent) {
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

  async function submitRegister(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, phone: phone.trim() || undefined }),
      });
      try {
        const data = await api<{ accessToken: string; refreshToken?: string; user: unknown }>(
          '/auth/login',
          { method: 'POST', body: JSON.stringify({ email, password }) },
        );
        await finishLogin(data);
      } catch {
        setMode('login');
        setErr(REGISTER_LOGIN_FAIL);
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Não foi possível cadastrar');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: '28px 0' }}>
      <h1>{mode === 'register' ? 'Criar conta' : 'Entrar'}</h1>
      {atCheckout ? (
        <p className="muted" style={{ maxWidth: 420 }}>
          Entre ou crie a conta agora para finalizar. Depois a sessão fica salva neste aparelho.
        </p>
      ) : null}
      <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          className={mode === 'login' ? 'btn' : 'btn ghost'}
          onClick={() => {
            setMode('login');
            setErr('');
          }}
        >
          Entrar
        </button>
        <button
          type="button"
          className={mode === 'register' ? 'btn' : 'btn ghost'}
          onClick={() => {
            setMode('register');
            setErr('');
          }}
        >
          Criar conta
        </button>
      </div>
      <form className="form" onSubmit={mode === 'register' ? submitRegister : submitLogin}>
        {err ? <div className="alert">{err}</div> : null}
        {mode === 'register' ? (
          <>
            <input
              placeholder="Nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
            <input
              type="tel"
              placeholder="WhatsApp (opcional, com DDD)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
            />
          </>
        ) : null}
        <input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <input
          type="password"
          placeholder={mode === 'register' ? 'Senha (mín. 8)' : 'Senha'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={mode === 'register' ? 8 : undefined}
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
        />
        <button className="btn" type="submit" disabled={busy}>
          {busy
            ? mode === 'register'
              ? 'Criando conta…'
              : 'Entrando…'
            : mode === 'register'
              ? 'Cadastrar e continuar'
              : 'Entrar'}
        </button>
        {mode === 'login' ? <Link href="/esqueci-senha">Esqueci minha senha</Link> : null}
        {mode === 'register' ? (
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setMode('login');
              setErr('');
            }}
          >
            Já tenho conta
          </button>
        ) : null}
      </form>
    </div>
  );
}
