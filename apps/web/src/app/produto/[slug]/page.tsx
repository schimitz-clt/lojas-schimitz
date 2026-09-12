import type { Metadata } from 'next';
import ProductClient from './ProductClient';
import { fetchProductMeta, fetchStoreSettings, siteOrigin } from '@/lib/storefront';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [product, store] = await Promise.all([fetchProductMeta(slug), fetchStoreSettings()]);
  const base = siteOrigin();
  const path = `/produto/${encodeURIComponent(slug)}`;
  if (!product) {
    return {
      title: 'Produto',
      description: store.siteDescription,
      alternates: { canonical: path },
    };
  }
  return {
    title: product.name,
    description: product.description,
    alternates: { canonical: path },
    openGraph: {
      title: product.name,
      description: product.description,
      type: 'website',
      url: `${base}${path}`,
      siteName: store.siteTitle,
      ...(product.image ? { images: [{ url: product.image }] } : {}),
    },
    twitter: {
      card: product.image ? 'summary_large_image' : 'summary',
      title: product.name,
      description: product.description,
      ...(product.image ? { images: [product.image] } : {}),
    },
  };
}

export default function Page() {
  return <ProductClient />;
}
