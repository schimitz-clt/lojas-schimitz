'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setMsg('');
    try {
      const data = await api<{ accepted: boolean; message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setSent(true);
      setMsg(data.message || 'Se o e-mail estiver cadastrado, enviaremos instruções em breve.');
    } catch (e: any) {
      setErr(e.message || 'Não foi possível solicitar a redefinição');
    }
  }

  return (
    <div style={{ padding: '28px 0' }}>
      <h1>Esqueci minha senha</h1>
      <form className="form" onSubmit={submit}>
        {err ? <div className="alert">{err}</div> : null}
        {msg ? <div className="alert" style={{ background: '#152a1d', color: '#c8f5d8' }}>{msg}</div> : null}
        {!sent ? (
          <>
            <p className="muted">Informe o e-mail da conta. Enviaremos um link para redefinir a senha.</p>
            <input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button className="btn" type="submit">
              Enviar link
            </button>
          </>
        ) : null}
        <Link href="/entrar">Voltar ao login</Link>
      </form>
    </div>
  );
}
