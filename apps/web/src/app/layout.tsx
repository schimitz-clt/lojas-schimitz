import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { MarketingPixels } from '@/components/MarketingPixels';
import './globals.css';
import '@/components/storefront/storefront-theme.css';
import '@/components/storefront/identidade.css';
import '@/components/storefront/schimitz-system.css';
import { StorefrontChrome } from '@/components/StorefrontChrome';
import { SessionHydrator } from '@/components/SessionHydrator';
import { ClientErrorReporter } from '@/components/ClientErrorReporter';
import { JsonLd } from '@/components/JsonLd';
import { buildStoreJsonLd } from '@/lib/json-ld';
import { resolveShareImage, shareImageTag } from '@/lib/og-image';
import { fetchStoreSettings, siteOrigin } from '@/lib/storefront';
import { storeWhatsAppDigits } from '@/lib/whatsapp';

/*
 * Fontes servidas do próprio repo (subset latin do Google Fonts, licença OFL;
 * ver fonts/LICENCAS.md). Antes vinham de `next/font/google`, que baixa do
 * Google a cada build: quando o download falhava, o `next build` quebrava
 * (CI e, no pior caso, o deploy do web no Railway).
 */
const schimitzSans = localFont({
  src: './fonts/InterTight-latin-var.woff2',
  display: 'swap',
  variable: '--font-schimitz',
  weight: '300 700',
  style: 'normal',
  fallback: ['system-ui', 'Arial', 'sans-serif'],
  adjustFontFallback: 'Arial',
});

const schimitzDisplay = localFont({
  src: [
    { path: './fonts/InstrumentSerif-latin-regular.woff2', weight: '400', style: 'normal' },
    { path: './fonts/InstrumentSerif-latin-italic.woff2', weight: '400', style: 'italic' },
  ],
  display: 'swap',
  variable: '--font-display',
  fallback: ['Georgia', 'Times New Roman', 'serif'],
  adjustFontFallback: 'Times New Roman',
});

const schimitzMono = localFont({
  src: './fonts/GeistMono-latin-var.woff2',
  display: 'swap',
  variable: '--font-mono',
  weight: '400 500',
  style: 'normal',
  fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
  adjustFontFallback: false,
});

/** Accessible viewport: pinch-zoom allowed. Safe-area + keyboard still apply. */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  /* Lets env(safe-area-inset-*) report the status bar / notch. Without this,
     notched phones and edge-to-edge WebViews draw the promo under the clock. */
  viewportFit: 'cover',
  themeColor: '#07122A',
  /* Keyboard resizes the layout instead of shoving the sticky search bar down. */
  interactiveWidget: 'resizes-content',
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
        { url: '/brand/n5/favicon.svg', type: 'image/svg+xml' },
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
    <html lang="pt-BR" className={`${schimitzSans.variable} ${schimitzDisplay.variable} ${schimitzMono.variable}`}>
      <body className={schimitzSans.className}>
        <MarketingPixels />
        <ClientErrorReporter />
        <JsonLd data={jsonLd} />
        <SessionHydrator>
          <StorefrontChrome>{children}</StorefrontChrome>
        </SessionHydrator>
      </body>
    </html>
  );
}
