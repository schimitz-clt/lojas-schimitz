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
    themeColor: '#0a0a0a',
    appleWebApp: {
      capable: true,
      title: s.siteTitle,
      statusBarStyle: 'black-translucent',
    },
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: '48x48' },
        { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
        { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
        { url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
        { url: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
      ],
      apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    },
    manifest: '/manifest.webmanifest',
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
