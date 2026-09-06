import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/Header';
import { ChatWidget } from '@/components/ChatWidget';
import { fetchStoreSettings, siteOrigin } from '@/lib/storefront';

export async function generateMetadata(): Promise<Metadata> {
  const s = await fetchStoreSettings();
  const base = siteOrigin();
  return {
    title: { default: s.siteTitle, template: `%s | ${s.siteTitle}` },
    description: s.siteDescription,
    metadataBase: new URL(base),
    openGraph: {
      title: s.siteTitle,
      description: s.siteDescription,
      locale: 'pt_BR',
      type: 'website',
      url: base,
      siteName: s.siteTitle,
      ...(s.ogImageUrl ? { images: [{ url: s.ogImageUrl }] } : {}),
    },
    twitter: {
      card: s.ogImageUrl ? 'summary_large_image' : 'summary',
      title: s.siteTitle,
      description: s.siteDescription,
      ...(s.ogImageUrl ? { images: [s.ogImageUrl] } : {}),
    },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <Header />
        <main className="wrap">{children}</main>
        <footer className="footer">
          <div className="wrap">
            <div className="footer-grid">
              <div className="footer-col">
                <h3>Lojas Schimitz</h3>
                <p className="muted" style={{ margin: 0, lineHeight: 1.45 }}>
                  Eletro, celulares, informática, eletrodomésticos e casa em Porto Alegre. Atendimento no
                  chat do site ou no WhatsApp (51) 99625-3766.
                </p>
              </div>
              <div className="footer-col">
                <h3>Loja</h3>
                <ul>
                  <li><a href="/produtos">Produtos</a></li>
                  <li><a href="/marketplace">Marketplace</a></li>
                  <li><a href="/departamento/ofertas">Ofertas</a></li>
                  <li><a href="/favoritos">Favoritos</a></li>
                </ul>
              </div>
              <div className="footer-col">
                <h3>Ajuda</h3>
                <ul>
                  <li><a href="/suporte">Suporte</a></li>
                  <li><a href="/pedidos">Meus pedidos</a></li>
                  <li><a href="/conta">Minha conta</a></li>
                  <li>
                    <a href="https://wa.me/5551996253766" target="_blank" rel="noreferrer">
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
                  <li>12x sem juros*</li>
                </ul>
              </div>
            </div>
            <p className="footer-copy muted">
              © {new Date().getFullYear()} Lojas Schimitz ·{' '}
              <a href="/produtos">Produtos</a> · <a href="/marketplace">Marketplace</a> ·{' '}
              <a href="/suporte">Suporte</a> ·{' '}
              <a href="https://wa.me/5551996253766" target="_blank" rel="noreferrer">
                WhatsApp
              </a>
            </p>
          </div>
        </footer>
        <ChatWidget />
      </body>
    </html>
  );
}
