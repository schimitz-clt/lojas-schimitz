import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import '@/components/storefront/storefront-theme.css';
import { StorefrontChrome } from '@/components/StorefrontChrome';
import { SessionHydrator } from '@/components/SessionHydrator';
import { JsonLd } from '@/components/JsonLd';
import { buildStoreJsonLd } from '@/lib/json-ld';
import { resolveShareImage, shareImageTag } from '@/lib/og-image';
import { fetchStoreSettings, siteOrigin } from '@/lib/storefront';
import { storeWhatsAppDigits } from '@/lib/whatsapp';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-schimitz',
  weight: ['400', '500', '600', '700', '800'],
});

/** Page/layout zoom locked like Magalu-style storefronts (pinch + double-tap).
 *  PDP photo enlarge remains the lightbox ("Ampliar"), not browser zoom. */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  /* Lets env(safe-area-inset-*) report the status bar / notch. Without this,
     notched phones and edge-to-edge WebViews draw the promo under the clock. */
  viewportFit: 'cover',
  themeColor: '#0a0a0a',
};

export async function generateMetadata(): Promise<Metadata> {
  const s = await fetchStoreSettings();
  const base = siteOrigin();
  const share = resolveShareImage(s.ogImageUrl, base);
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
      images: [shareImageTag(share)],
    },
    twitter: {
      card: share.twitterCard,
      title: s.siteTitle,
      description: s.siteDescription,
      images: [share.url],
    },
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await fetchStoreSettings();
  const origin = siteOrigin();
  const jsonLd = buildStoreJsonLd(origin, {
    name: settings.siteTitle,
    description: settings.siteDescription,
    logoUrl: '/android-chrome-512x512.png',
    telephone: storeWhatsAppDigits(process.env.NEXT_PUBLIC_WHATSAPP),
  });
  return (
    <html lang="pt-BR" className={jakarta.variable}>
      <body className={jakarta.className}>
        <JsonLd data={jsonLd} />
        <SessionHydrator>
          <StorefrontChrome>{children}</StorefrontChrome>
        </SessionHydrator>
      </body>
    </html>
  );
}
