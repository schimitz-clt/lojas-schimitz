import type { Metadata } from 'next';
import ProductClient from './ProductClient';
import { JsonLd } from '@/components/JsonLd';
import { buildBreadcrumbList, buildProductJsonLd } from '@/lib/json-ld';
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

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const product = await fetchProductMeta(slug);
  const origin = siteOrigin();

  const jsonLd = [];
  if (product && product.price !== undefined && product.price !== null) {
    jsonLd.push(
      buildProductJsonLd(origin, {
        name: product.name,
        description: product.description,
        slug: product.slug || slug,
        sku: product.sku,
        price: product.price,
        image: product.image,
        images: product.images,
        stock: product.stock,
        condition: product.condition,
        sellerName: product.seller?.name,
        brandName: product.seller?.name,
        ratingAvg: product.ratingAvg,
        ratingCount: product.ratingCount,
      }),
    );
  }

  const crumbItems = [{ name: 'Início', path: '/' }];
  if (product?.category?.slug && product.category.name) {
    crumbItems.push({
      name: product.category.name,
      path: `/departamento/${encodeURIComponent(product.category.slug)}`,
    });
  } else {
    crumbItems.push({ name: 'Produtos', path: '/produtos' });
  }
  crumbItems.push({
    name: product?.name || slug,
    path: `/produto/${encodeURIComponent(slug)}`,
  });
  jsonLd.push(buildBreadcrumbList(origin, crumbItems));

  return (
    <>
      <JsonLd data={jsonLd} />
      <ProductClient />
    </>
  );
}
