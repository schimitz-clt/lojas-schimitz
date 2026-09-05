'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { sendChat, type ChatProductHit, waLink } from '@/lib/api';

type UiMsg = { id: string; role: 'user' | 'assistant'; text: string; handoff?: boolean; products?: ChatProductHit[] };

const SID = 'sch_chat_id';
const MSGS = 'sch_chat_msgs';

const WELCOME: UiMsg = {
  id: 'welcome',
  role: 'assistant',
  text: 'Olá! Sou o assistente da Lojas Schimitz. Posso falar de frete, PIX, parcelamento, cupons, SCHIMITZ+ e produtos do catálogo. Se quiser uma pessoa, te passo para o WhatsApp.',
};

function loadMsgs(): UiMsg[] {
  if (typeof window === 'undefined') return [WELCOME];
  try {
    const raw = sessionStorage.getItem(MSGS);
    if (!raw) return [WELCOME];
    const parsed = JSON.parse(raw) as UiMsg[];
    return parsed.length ? parsed : [WELCOME];
  } catch {
    return [WELCOME];
  }
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msgs, setMsgs] = useState<UiMsg[]>([WELCOME]);
  const [cid, setCid] = useState<string | undefined>();
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMsgs(loadMsgs());
    setCid(sessionStorage.getItem(SID) || undefined);
  }, []);

  useEffect(() => {
    if (open) bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [open, msgs, busy]);

  function persist(next: UiMsg[], conversationId?: string) {
    setMsgs(next);
    sessionStorage.setItem(MSGS, JSON.stringify(next.slice(-24)));
    if (conversationId) {
      setCid(conversationId);
      sessionStorage.setItem(SID, conversationId);
    }
  }

  async function onSend(e?: FormEvent) {
    e?.preventDefault();
    const message = text.trim();
    if (!message || busy) return;
    setText('');
    setErr('');
    const userMsg: UiMsg = { id: crypto.randomUUID(), role: 'user', text: message };
    persist([...msgs, userMsg], cid);
    setBusy(true);
    try {
      const data = await sendChat(message, cid);
      const bot: UiMsg = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: data.reply,
        handoff: data.handoff,
        products: data.products,
      };
      persist([...msgs, userMsg, bot], data.conversationId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro no chat';
      setErr(/rate|muitas|429|limit/i.test(msg)
        ? 'Muitas mensagens em pouco tempo. Espere um minuto e tente de novo — ou fale no WhatsApp.'
        : msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chatw">
      {open ? (
        <section className="chatw-panel" aria-label="Chat Lojas Schimitz">
          <header className="chatw-head">
            <div>
              <strong>Lojas Schimitz</strong>
              <div className="muted">Assistente · Porto Alegre</div>
            </div>
            <button type="button" className="chatw-x" onClick={() => setOpen(false)} aria-label="Fechar chat">
              ×
            </button>
          </header>
          <div className="chatw-body">
            {msgs.map((m) => (
              <div key={m.id} className={`chatw-msg ${m.role}`}>
                <p>{m.text}</p>
                {m.products && m.products.length > 0 ? (
                  <ul className="chatw-prods">
                    {m.products.map((p) => (
                      <li key={p.slug}>
                        <a href={p.path}>{p.name}</a>
                        <span className="muted">
                          {' '}
                          {Number(p.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          {p.inStock ? '' : ' · sem estoque'}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {m.handoff ? (
                  <a className="btn wa chatw-wa" href={waLink('Olá, vim pelo chat da Lojas Schimitz e quero falar com um atendente.')} target="_blank" rel="noreferrer">
                    Continuar no WhatsApp
                  </a>
                ) : null}
              </div>
            ))}
            {busy ? <div className="chatw-msg assistant muted">Digitando…</div> : null}
            {err ? <div className="alert">{err}</div> : null}
            <div ref={bottom} />
          </div>
          <form className="chatw-form" onSubmit={onSend}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Pergunte sobre frete, PIX, produtos…"
              maxLength={1200}
              aria-label="Mensagem"
              disabled={busy}
            />
            <button className="btn" type="submit" disabled={busy || !text.trim()}>
              Enviar
            </button>
          </form>
          <a className="chatw-human" href={waLink('Olá, vim pelo chat da Lojas Schimitz.')} target="_blank" rel="noreferrer">
            Falar com humano no WhatsApp
          </a>
        </section>
      ) : null}
      <button
        type="button"
        className="chatw-fab"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Fechar assistente' : 'Abrir assistente da loja'}
      >
        {open ? '×' : 'Chat'}
      </button>
    </div>
  );
}
