import type { MetadataRoute } from 'next';

/** PWA / installed-app icons. Maskable entries keep the wordmark in the safe zone. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Lojas Schimitz',
    short_name: 'Schimitz',
    description:
      'Tudo o que você precisa. No padrão das grandes. Eletro, celulares e casa em Porto Alegre.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f6efe4',
    theme_color: '#07122A',
    lang: 'pt-BR',
    icons: [
      {
        src: '/favicon-16x16.png',
        sizes: '16x16',
        type: 'image/png',
      },
      {
        src: '/favicon-32x32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-maskable-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
