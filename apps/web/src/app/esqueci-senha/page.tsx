'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  PASSWORD_RESET_CPF_KEY,
  parsePasswordResetCpf,
  signupEmailForApi,
  signupEmailIssue,
} from '@/lib/signup-flow';

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState('');
  const [cpfReset, setCpfReset] = useState<{ cpf: string; maskedEmail: string } | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const raw = new URLSearchParams(window.location.search).get('email') || '';
      if (raw && !signupEmailIssue(raw)) setEmail(signupEmailForApi(raw));
      const stored = parsePasswordResetCpf(window.sessionStorage.getItem(PASSWORD_RESET_CPF_KEY));
      if (stored) setCpfReset(stored);
    } catch {
      /* ignore */
    }
  }, []);

  function clearCpfReset() {
    setCpfReset(null);
    try {
      window.sessionStorage.removeItem(PASSWORD_RESET_CPF_KEY);
    } catch {
      /* ignore */
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErr('');
    setMsg('');
    setBusy(true);
    try {
      if (cpfReset) {
        const data = await api<{ accepted: boolean; message: string }>('/auth/forgot-password-cpf', {
          method: 'POST',
          body: JSON.stringify({ cpf: cpfReset.cpf }),
        });
        setSent(true);
        setMsg(data.message || 'Se o e-mail estiver cadastrado, enviaremos instruções em breve.');
        clearCpfReset();
        return;
      }
      const data = await api<{ accepted: boolean; message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setSent(true);
      setMsg(data.message || 'Se o e-mail estiver cadastrado, enviaremos instruções em breve.');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Não foi possível solicitar a redefinição');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: '28px 0' }}>
      <h1>Esqueci minha senha</h1>
      <form className="form" onSubmit={submit}>
        {err ? <div className="alert">{err}</div> : null}
        {msg ? <div className="alert" style={{ background: '#152a1d', color: '#c8f5d8' }}>{msg}</div> : null}
        {!sent && cpfReset ? (
          <>
            <p className="muted">
              Enviaremos o link de redefinição para {cpfReset.maskedEmail}. A senha é a desse e-mail.
            </p>
            <button className="btn" type="submit" disabled={busy}>
              {busy ? 'Enviando…' : 'Enviar link'}
            </button>
            <button type="button" className="acct-textlink" onClick={clearCpfReset} disabled={busy}>
              Usar outro e-mail
            </button>
          </>
        ) : null}
        {!sent && !cpfReset ? (
          <>
            <p className="muted">Informe o e-mail da conta. Enviaremos um link para redefinir a senha.</p>
            <input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button className="btn" type="submit" disabled={busy || Boolean(signupEmailIssue(email))}>
              {busy ? 'Enviando…' : 'Enviar link'}
            </button>
          </>
        ) : null}
        <Link href="/entrar">Voltar ao login</Link>
      </form>
    </div>
  );
}
