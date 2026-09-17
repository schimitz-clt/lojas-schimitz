import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import '@/components/storefront/storefront-theme.css';
import { StorefrontChrome } from '@/components/StorefrontChrome';
import { fetchStoreSettings, siteOrigin } from '@/lib/storefront';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-schimitz',
  weight: ['400', '500', '600', '700', '800'],
});

export async function generateMetadata(): Promise<Metadata> {
  const s = await fetchStoreSettings();
  const base = siteOrigin();
  return {
    title: { default: s.siteTitle, template: `%s | ${s.siteTitle}` },
    description: s.siteDescription,
    metadataBase: new URL(base),
    alternates: { canonical: '/' },
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
    <html lang="pt-BR" className={jakarta.variable}>
      <body className={jakarta.className}>
        <StorefrontChrome>{children}</StorefrontChrome>
      </body>
    </html>
  );
}
