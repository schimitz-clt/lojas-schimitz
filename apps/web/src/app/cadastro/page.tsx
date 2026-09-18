'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

const REGISTER_ACCEPTED_FALLBACK =
  'Se o e-mail ainda não estiver cadastrado, sua conta foi criada. Faça login para continuar.';

export default function CadastroPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setMsg('');
    try {
      const data = await api<{ accepted?: boolean; message?: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, phone: phone.trim() || undefined }),
      });
      try { localStorage.removeItem('sch_guest'); } catch { /* ignore */ }
      setDone(true);
      setMsg(data.message || REGISTER_ACCEPTED_FALLBACK);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  return (
    <div style={{ padding: '28px 0' }}>
      <h1>Criar conta</h1>
      <form className="form" onSubmit={submit}>
        {err ? <div className="alert">{err}</div> : null}
        {msg ? <div className="alert" style={{ background: '#152a1d', color: '#c8f5d8' }}>{msg}</div> : null}
        {!done ? (
          <>
            <input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} required />
            <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input type="tel" placeholder="WhatsApp (opcional, com DDD)" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <input type="password" placeholder="Senha (mín. 8)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            <button className="btn" type="submit">Cadastrar</button>
          </>
        ) : null}
        <Link href="/entrar">Já tenho conta</Link>
      </form>
    </div>
  );
}
