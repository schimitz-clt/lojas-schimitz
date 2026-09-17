'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Header } from '@/components/Header';
import { BottomNav } from '@/components/BottomNav';
import { ChatWidget } from '@/components/ChatWidget';
import { INTEREST_FREE_INSTALLMENTS } from '@/lib/pricing';

/**
 * Storefront chrome (header/footer/bottom nav/chat) — skipped on /admin
 * so AdminShell can own the full viewport (Phase 1 professional console).
 */
export function StorefrontChrome({ children }: { children: ReactNode }) {
  const path = usePathname() || '';
  const isAdmin = path === '/admin' || path.startsWith('/admin/');

  if (isAdmin) {
    return <div className="admin-root">{children}</div>;
  }

  return (
    <>
      <Header />
      <main className="wrap main-shell">{children}</main>
      <footer className="footer">
        <div className="wrap">
          <div className="footer-grid">
            <div className="footer-col">
              <h3>Lojas Schimitz</h3>
              <p className="muted" style={{ margin: 0, lineHeight: 1.4 }}>
                Eletro, celulares e casa em Porto Alegre. Chat ou WhatsApp (51) 99625-3766.
              </p>
            </div>
            <div className="footer-col">
              <h3>Loja</h3>
              <ul>
                <li>
                  <a href="/produtos">Produtos</a>
                </li>
                <li>
                  <a href="/marketplace">Marketplace</a>
                </li>
                <li>
                  <a href="/departamento/ofertas">Ofertas</a>
                </li>
                <li>
                  <a href="/favoritos">Favoritos</a>
                </li>
              </ul>
            </div>
            <div className="footer-col">
              <h3>Ajuda</h3>
              <ul>
                <li>
                  <a href="/suporte">Suporte</a>
                </li>
                <li>
                  <a href="/privacidade">Privacidade</a>
                </li>
                <li>
                  <a href="/termos">Termos</a>
                </li>
                <li>
                  <a href="/pedidos">Meus pedidos</a>
                </li>
                <li>
                  <a href="/conta">Minha conta</a>
                </li>
                <li>
                  <a
                    href="https://wa.me/5551996253766"
                    target="_blank"
                    rel="noreferrer"
                  >
                    WhatsApp
                  </a>
                </li>
              </ul>
            </div>
            <div className="footer-col">
              <h3>Benefícios</h3>
              <ul>
                <li>Frete grátis em Porto Alegre</li>
                <li>Troca em 7 dias</li>
                <li>PIX 5% off</li>
                <li>{INTEREST_FREE_INSTALLMENTS}x sem juros</li>
              </ul>
            </div>
          </div>
          <p className="footer-copy muted">
            © {new Date().getFullYear()} Lojas Schimitz ·{' '}
            <a href="/produtos">Produtos</a> · <a href="/marketplace">Marketplace</a> ·{' '}
            <a href="/suporte">Suporte</a> · <a href="/privacidade">Privacidade</a> ·{' '}
            <a href="/termos">Termos</a> ·{' '}
            <a href="https://wa.me/5551996253766" target="_blank" rel="noreferrer">
              WhatsApp
            </a>
          </p>
        </div>
      </footer>
      <BottomNav />
      <ChatWidget />
    </>
  );
}
