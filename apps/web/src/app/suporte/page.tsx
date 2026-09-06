'use client';

import Link from 'next/link';
import { waLink } from '@/lib/api';

const WA_DISPLAY = '(51) 99625-3766';
const WA_HREF = 'https://wa.me/5551996253766';

export default function SuportePage() {
  return (
    <div style={{ padding: '22px 0', maxWidth: 720 }}>
      <h1>Suporte</h1>
      <p style={{ marginBottom: 16 }}>
        Precisa de ajuda com pedido, frete, PIX, troca ou produto? Fale conosco pelo chat do site
        ou pelo WhatsApp da Lojas Schimitz.
      </p>

      <section
        className="hero"
        style={{ marginBottom: 20, padding: 20 }}
        aria-label="Canais de atendimento"
      >
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Atendimento</h2>
        <ul style={{ margin: '0 0 16px', paddingLeft: 18, lineHeight: 1.7 }}>
          <li>
            <strong>Chat no site</strong> — use o botão <em>Chat</em> no canto da tela para falar
            com o assistente (FAQ, catálogo e encaminhamento humano).
          </li>
          <li>
            <strong>WhatsApp</strong> — {WA_DISPLAY}
          </li>
        </ul>
        <div className="actions" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <a
            className="btn wa"
            href={waLink('Olá, vim pela página de suporte da Lojas Schimitz.')}
            target="_blank"
            rel="noreferrer"
          >
            Abrir WhatsApp {WA_DISPLAY}
          </a>
          <a className="btn ghost" href={WA_HREF} target="_blank" rel="noreferrer">
            wa.me/5551996253766
          </a>
          <Link className="btn ghost" href="/">
            Ir à loja
          </Link>
        </div>
      </section>

      <section aria-label="Perguntas frequentes rápidas">
        <h2 style={{ fontSize: 18 }}>Respostas rápidas</h2>
        <ul style={{ lineHeight: 1.8, paddingLeft: 18 }}>
          <li>PIX: 5% de desconto à vista.</li>
          <li>Cartão: até 12x pelo Mercado Pago.</li>
          <li>Frete grátis em Porto Alegre (CEP iniciando em 90).</li>
          <li>Troca em até 7 dias, conforme as regras da loja.</li>
        </ul>
        <p className="muted" style={{ marginTop: 12 }}>
          Também: <Link href="/produtos">ver produtos</Link> ·{' '}
          <Link href="/pedidos">meus pedidos</Link> · <Link href="/conta">minha conta</Link>
        </p>
      </section>
    </div>
  );
}
