'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, sendChat, type ChatProductHit, waLink } from '@/lib/api';
import { pixPrice } from '@/lib/pricing';

type UiMsg = { id: string; role: 'user' | 'assistant'; text: string; handoff?: boolean; products?: ChatProductHit[] };

const SID = 'sch_chat_id';
const MSGS = 'sch_chat_msgs';

const WELCOME: UiMsg = {
  id: 'welcome',
  role: 'assistant',
  text: 'Olá! Sou o Schimitz AI. Busco no catálogo real, comparo opções e falo de PIX, frete e troca — sem inventar preço ou estoque. WhatsApp (51) 99625-3766.',
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

function brl(n: number) {
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function ProductMiniCard({ p }: { p: ChatProductHit }) {
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const pix = p.pixPrice != null ? Number(p.pixPrice) : pixPrice(p.price);
  const canCart = Boolean(p.id) && p.inStock;

  async function addToCart() {
    if (!p.id || adding || !p.inStock) return;
    setAdding(true);
    try {
      await api('/cart/items', { method: 'POST', body: JSON.stringify({ productId: p.id, qty: 1 }) });
      setAdded(true);
      try {
        window.dispatchEvent(new Event('sch-cart-updated'));
      } catch {
        /* ignore */
      }
      window.setTimeout(() => setAdded(false), 1600);
    } catch {
      window.location.href = p.path || `/produto/${p.slug}`;
    } finally {
      setAdding(false);
    }
  }

  return (
    <li className="chatw-card">
      <a href={p.path || `/produto/${p.slug}`} className="chatw-card-media" aria-label={p.name}>
        {p.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image} alt="" width={64} height={64} />
        ) : (
          <span className="chatw-card-ph" aria-hidden>
            S
          </span>
        )}
      </a>
      <div className="chatw-card-body">
        <a className="chatw-card-name" href={p.path || `/produto/${p.slug}`}>
          {p.name}
        </a>
        <div className="chatw-card-price">{brl(Number(p.price))}</div>
        <div className="chatw-card-pix">PIX {brl(pix)}</div>
        {!p.inStock ? <div className="muted">Sem estoque</div> : null}
        <div className="chatw-card-cta">
          <a className="btn ghost" href={p.path || `/produto/${p.slug}`}>
            Ver
          </a>
          {canCart ? (
            <button type="button" className="btn" onClick={addToCart} disabled={adding}>
              {added ? 'Adicionado' : adding ? '…' : 'Carrinho'}
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
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
        <section className="chatw-panel" aria-label="Schimitz AI">
          <header className="chatw-head">
            <div>
              <strong>Schimitz AI</strong>
              <div className="muted">Assistente de compras · Porto Alegre</div>
            </div>
            <button type="button" className="chatw-x" onClick={() => setOpen(false)} aria-label="Fechar Schimitz AI">
              ×
            </button>
          </header>
          <div className="chatw-body">
            {msgs.map((m) => (
              <div key={m.id} className={`chatw-msg ${m.role}`}>
                <p>{m.text}</p>
                {m.products && m.products.length > 0 ? (
                  <ul className="chatw-cards">
                    {m.products.map((p) => (
                      <ProductMiniCard key={p.slug} p={p} />
                    ))}
                  </ul>
                ) : null}
                {m.handoff ? (
                  <a className="btn wa chatw-wa" href={waLink('Olá, vim pelo Schimitz AI da Lojas Schimitz e quero falar com um atendente.')} target="_blank" rel="noreferrer">
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
              placeholder="Produto, PIX, frete…"
              maxLength={1200}
              aria-label="Mensagem para o Schimitz AI"
              disabled={busy}
            />
            <button className="btn" type="submit" disabled={busy || !text.trim()}>
              Enviar
            </button>
          </form>
          <a className="chatw-human" href={waLink('Olá, vim pelo Schimitz AI da Lojas Schimitz.')} target="_blank" rel="noreferrer">
            Falar no WhatsApp
          </a>
        </section>
      ) : null}
      <button
        type="button"
        className="chatw-fab"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Fechar Schimitz AI' : 'Abrir Schimitz AI'}
      >
        {open ? '×' : 'AI'}
      </button>
    </div>
  );
}
