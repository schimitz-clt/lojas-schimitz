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
            <p><b>Sobre a Lojas Schimitz</b> — eletro, celulares, informática, eletrodomésticos e casa em Porto Alegre. Atendimento humano no WhatsApp (51) 99625-3766.</p>
            <p>Frete grátis acima de R$ 299 · Troca em 7 dias · PIX 5% off · 12x sem juros*</p>
            <p>Loja própria · assistente no site · WhatsApp (51) 99625-3766</p>
          </div>
        </footer>
        <ChatWidget />
      </body>
    </html>
  );
}
