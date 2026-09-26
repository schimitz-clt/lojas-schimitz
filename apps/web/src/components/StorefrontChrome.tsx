'use client';

import { Suspense, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Header } from '@/components/Header';
import { UtmCapture } from '@/components/UtmCapture';
import { NavigationProgress } from '@/components/NavigationProgress';
import { BottomNav } from '@/components/BottomNav';
import { ChatWidget } from '@/components/ChatWidget';
import { CompareProvider } from '@/components/compare/CompareProvider';
import { CompareBar } from '@/components/compare/CompareBar';
import { FavoritesProvider } from '@/components/favorites/FavoritesProvider';
import { StorefrontToast } from '@/components/StorefrontToast';
import { INTEREST_FREE_INSTALLMENTS } from '@/lib/pricing';
import { FooterTrustStrip } from '@/components/FooterTrustStrip';

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
    <CompareProvider>
      <FavoritesProvider>
        <NavigationProgress />
        <Suspense fallback={null}>
          <UtmCapture />
          <Header />
        </Suspense>
        <main className="wrap main-shell">{children}</main>
      <footer className="footer">
        <div className="wrap">
          <FooterTrustStrip />
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
                  <Link href="/produtos" prefetch={true}>
                    Produtos
                  </Link>
                </li>
                <li>
                  <Link href="/marketplace" prefetch={true}>
                    Marketplace
                  </Link>
                </li>
                <li>
                  <Link href="/departamento/ofertas" prefetch={true}>
                    Ofertas
                  </Link>
                </li>
                <li>
                  <Link href="/conta/salvos" prefetch={true}>
                    Salvos
                  </Link>
                </li>
                <li>
                  <Link href="/comparar" prefetch={true}>
                    Comparar
                  </Link>
                </li>
              </ul>
            </div>
            <div className="footer-col">
              <h3>Ajuda</h3>
              <ul>
                <li>
                  <Link href="/suporte" prefetch={true}>
                    Suporte
                  </Link>
                </li>
                <li>
                  <Link href="/privacidade" prefetch={true}>
                    Privacidade
                  </Link>
                </li>
                <li>
                  <Link href="/termos" prefetch={true}>
                    Termos
                  </Link>
                </li>
                <li>
                  <Link href="/pedidos" prefetch={true}>
                    Meus pedidos
                  </Link>
                </li>
                <li>
                  <Link href="/conta" prefetch={true}>
                    Minha conta
                  </Link>
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
            <Link href="/produtos" prefetch={true}>
              Produtos
            </Link>{' '}
            ·{' '}
            <Link href="/marketplace" prefetch={true}>
              Marketplace
            </Link>{' '}
            ·{' '}
            <Link href="/suporte" prefetch={true}>
              Suporte
            </Link>{' '}
            ·{' '}
            <Link href="/privacidade" prefetch={true}>
              Privacidade
            </Link>{' '}
            ·{' '}
            <Link href="/termos" prefetch={true}>
              Termos
            </Link>{' '}
            ·{' '}
            <a href="https://wa.me/5551996253766" target="_blank" rel="noreferrer">
              WhatsApp
            </a>
          </p>
        </div>
      </footer>
      <CompareBar />
      {/* Shared docked bar for every non-admin route: home, busca, PDP, sacola, checkout, conta, and the order payment step. Card Brick renders inline on /pedidos — it is not a fullscreen WebView — so the bar stays. */}
      <BottomNav />
      <StorefrontToast />
      <ChatWidget />
      </FavoritesProvider>
    </CompareProvider>
  );
}
