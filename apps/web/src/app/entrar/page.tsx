'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api, saveSession } from '@/lib/api';

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      const data = await api<any>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      saveSession(data);
      window.location.href = safeNextPath();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  return (
    <div style={{ padding: '28px 0' }}>
      <h1>Entrar</h1>
      <form className="form" onSubmit={submit}>
        {err ? <div className="alert">{err}</div> : null}
        <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button className="btn" type="submit">Entrar</button>
        <Link href="/cadastro">Criar conta</Link>
      </form>
    </div>
  );
}
