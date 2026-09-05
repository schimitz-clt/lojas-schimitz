'use client';
import { useState } from 'react';
import { api, saveSession } from '@/lib/api';

export default function CadastroPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      const data = await api<any>('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
      saveSession(data);
      window.location.href = '/conta';
    } catch (e: any) {
      setErr(e.message);
    }
  }

  return (
    <div style={{ padding: '28px 0' }}>
      <h1>Criar conta</h1>
      <form className="form" onSubmit={submit}>
        {err ? <div className="alert">{err}</div> : null}
        <input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} required />
        <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Senha (mín. 8)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        <button className="btn" type="submit">Cadastrar</button>
      </form>
    </div>
  );
}
