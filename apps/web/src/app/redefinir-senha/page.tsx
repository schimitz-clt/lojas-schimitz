'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { api, clearSession } from '@/lib/api';

function tokenFromQuery(): string {
  if (typeof window === 'undefined') return '';
  try {
    return new URLSearchParams(window.location.search).get('token') || '';
  } catch {
    return '';
  }
}

export default function RedefinirSenhaPage() {
  const initialToken = useMemo(() => tokenFromQuery(), []);
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [err, setErr] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setOkMsg('');
    if (password !== password2) {
      setErr('As senhas não coincidem');
      return;
    }
    try {
      const data = await api<{ reset: boolean; message: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      clearSession();
      setDone(true);
      setOkMsg(data.message || 'Senha atualizada. Faça login com a nova senha.');
    } catch (e: any) {
      setErr(e.message || 'Não foi possível redefinir a senha');
    }
  }

  return (
    <div style={{ padding: '28px 0' }}>
      <h1>Redefinir senha</h1>
      <form className="form" onSubmit={submit}>
        {err ? <div className="alert">{err}</div> : null}
        {okMsg ? <div className="alert" style={{ background: '#152a1d', color: '#c8f5d8' }}>{okMsg}</div> : null}
        {!done ? (
          <>
            {!initialToken ? (
              <input
                type="text"
                placeholder="Cole o token do e-mail"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
                minLength={20}
              />
            ) : null}
            <input
              type="password"
              placeholder="Nova senha (mín. 8, letras e números)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            <input
              type="password"
              placeholder="Confirmar nova senha"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              required
              minLength={8}
            />
            <button className="btn" type="submit" disabled={!token}>
              Salvar nova senha
            </button>
          </>
        ) : (
          <Link className="btn" href="/entrar">
            Ir para o login
          </Link>
        )}
        <Link href="/entrar">Voltar ao login</Link>
      </form>
    </div>
  );
}
