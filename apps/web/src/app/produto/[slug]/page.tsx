import type { Metadata } from 'next';
import ProductClient from './ProductClient';
import { fetchProductMeta, fetchStoreSettings } from '@/lib/storefront';

type Props = { params: Promise<{ slug: string }> | { slug: string } };

async function resolveParams(params: Props['params']) {
  return typeof (params as Promise<{ slug: string }>).then === 'function'
    ? await (params as Promise<{ slug: string }>)
    : (params as { slug: string });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await resolveParams(params);
  const [product, store] = await Promise.all([fetchProductMeta(slug), fetchStoreSettings()]);
  if (!product) {
    return { title: 'Produto', description: store.siteDescription };
  }
  return {
    title: product.name,
    description: product.description,
    openGraph: {
      title: product.name,
      description: product.description,
      type: 'website',
      ...(product.image ? { images: [{ url: product.image }] } : {}),
    },
  };
}

export default function Page() {
  return <ProductClient />;
}
