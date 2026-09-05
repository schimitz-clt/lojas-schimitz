import './globals.css';
import { Header } from '@/components/Header';

export const metadata = {
  title: { default: 'Lojas Schimitz', template: '%s | Lojas Schimitz' },
  description: 'Tudo o que você precisa. No padrão das grandes. Eletro, celulares e casa em Porto Alegre.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  openGraph: {
    title: 'Lojas Schimitz',
    description: 'Tudo o que você precisa. No padrão das grandes.',
    locale: 'pt_BR',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <Header />
        <main className="wrap">{children}</main>
        <footer className="footer">
          <div className="wrap">
            <p><b>Sobre a Lojas Schimitz</b> — eletro, celulares, informática, eletrodomésticos e casa. Atendimento humano no WhatsApp (51) 99625-3766.</p>
            <p>Frete grátis acima de R$ 299 · Troca em 7 dias · PIX 5% off · 12x sem juros*</p>
            <p>A vitrine Netlify atual permanece no ar até a migração autorizada.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
