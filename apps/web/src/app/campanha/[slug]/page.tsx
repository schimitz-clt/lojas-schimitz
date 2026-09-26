import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CampaignView, type CampaignProduct } from './CampaignView';
import { fetchPublicProduct, fetchStoreSettings, siteOrigin } from '@/lib/storefront';
import { storefrontPageMetadata } from '@/lib/seo-metadata';
import { resolveProductShareImage } from '@/lib/og-image';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [product, store] = await Promise.all([fetchPublicProduct(slug), fetchStoreSettings()]);
  if (!product || product.isDemo === true || typeof product.name !== 'string') {
    return { title: 'Campanha', robots: { index: false, follow: false } };
  }
  const base = siteOrigin();
  const name = product.name;
  const description = typeof product.description === 'string' ? product.description : name;
  const image =
    typeof product.image === 'string'
      ? product.image
      : Array.isArray(product.images) && product.images[0] && typeof (product.images[0] as { url?: string }).url === 'string'
        ? (product.images[0] as { url: string }).url
        : null;
  return storefrontPageMetadata({
    title: name,
    description,
    path: `/campanha/${encodeURIComponent(typeof product.slug === 'string' ? product.slug : slug)}`,
    siteName: store.siteTitle,
    origin: base,
    image: resolveProductShareImage(image, base, name),
  });
}

export default async function CampaignPage({ params }: Props) {
  const { slug } = await params;
  const product = await fetchPublicProduct(slug);
  if (!product || product.isDemo === true || typeof product.slug !== 'string' || typeof product.name !== 'string') {
    notFound();
  }
  return <CampaignView product={product as CampaignProduct} />;
}
