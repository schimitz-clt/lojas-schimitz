import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BRAND_SHARE_IMAGE_ALT,
  BRAND_SHARE_IMAGE_HEIGHT,
  BRAND_SHARE_IMAGE_PATH,
  BRAND_SHARE_IMAGE_WIDTH,
} from '@/lib/og-image';

/**
 * Unknown routes and notFound() (missing products) share this page.
 * Replaces the English Next.js default, which also forced a full-viewport
 * blank and pushed the storefront footer below the fold.
 */
export const metadata: Metadata = {
  title: 'Página não encontrada',
  description: 'Esse endereço não existe ou o produto saiu do ar.',
  robots: { index: false, follow: true },
  openGraph: {
    title: 'Página não encontrada',
    description: 'Esse endereço não existe ou o produto saiu do ar.',
    locale: 'pt_BR',
    type: 'website',
    images: [
      {
        url: BRAND_SHARE_IMAGE_PATH,
        alt: BRAND_SHARE_IMAGE_ALT,
        width: BRAND_SHARE_IMAGE_WIDTH,
        height: BRAND_SHARE_IMAGE_HEIGHT,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Página não encontrada',
    description: 'Esse endereço não existe ou o produto saiu do ar.',
    images: [BRAND_SHARE_IMAGE_PATH],
  },
};

export default function NotFound() {
  return (
    <section className="not-found" aria-labelledby="not-found-title">
      <p className="not-found-kicker">404</p>
      <h1 id="not-found-title">Página não encontrada</h1>
      <p>
        Esse endereço não existe ou o produto saiu do ar. Volte para a loja ou procure no catálogo.
      </p>
      <div className="not-found-actions">
        <Link className="btn" href="/">
          Ir para o início
        </Link>
        <Link className="btn ghost" href="/produtos">
          Ver produtos
        </Link>
      </div>
    </section>
  );
}
