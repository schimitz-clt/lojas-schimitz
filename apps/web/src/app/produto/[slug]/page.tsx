import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound, permanentRedirect } from 'next/navigation';
import ProductClient, { type ProductDetail } from './ProductClient';
import { JsonLd } from '@/components/JsonLd';
import { PdpRelatedProducts } from '@/components/PdpRelatedProducts';
import { buildBreadcrumbList, buildProductJsonLd } from '@/lib/json-ld';
import { resolveProductShareImage } from '@/lib/og-image';
import { isMissingPdp, pdpBreadcrumbName } from '@/lib/pdp-missing';
import { resolveProductSlugRedirect } from '@/lib/product-slug-redirects';
import { missingPageMetadata, storefrontPageMetadata } from '@/lib/seo-metadata';
import type { Product } from '@/components/ProductCard';
import {
  fetchProductMeta,
  fetchPublicProduct,
  fetchRelatedCatalogProducts,
  fetchStoreSettings,
  publicProductCategorySlug,
  publicProductId,
  siteOrigin,
} from '@/lib/storefront';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const alias = resolveProductSlugRedirect(rawSlug);
  const slug = alias || rawSlug;
  const [product, store] = await Promise.all([fetchProductMeta(slug), fetchStoreSettings()]);
  const base = siteOrigin();
  const path = `/produto/${encodeURIComponent(slug)}`;
  if (!product) {
    return missingPageMetadata();
  }
  return storefrontPageMetadata({
    title: product.name,
    description: product.description,
    path,
    siteName: store.siteTitle,
    origin: base,
    image: resolveProductShareImage(product.image, base, product.name),
  });
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const alias = resolveProductSlugRedirect(slug);
  if (alias) {
    permanentRedirect(`/produto/${encodeURIComponent(alias)}`);
  }
  const [product, initial] = await Promise.all([fetchProductMeta(slug), fetchPublicProduct(slug)]);
  if (isMissingPdp(product, initial) || !product || !initial || typeof initial.slug !== 'string') {
    notFound();
  }
  const origin = siteOrigin();
  const categorySlug = publicProductCategorySlug(initial) || product.category?.slug || null;

  const jsonLd = [];
  if (product.price !== undefined && product.price !== null) {
    jsonLd.push(
      buildProductJsonLd(origin, {
        name: product.name,
        description: product.description,
        slug: product.slug,
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
  if (product.category?.slug && product.category.name) {
    crumbItems.push({
      name: product.category.name,
      path: `/departamento/${encodeURIComponent(product.category.slug)}`,
    });
  } else {
    crumbItems.push({ name: 'Produtos', path: '/produtos' });
  }
  crumbItems.push({
    name: pdpBreadcrumbName(product.name),
    path: `/produto/${encodeURIComponent(product.slug || slug)}`,
  });
  jsonLd.push(buildBreadcrumbList(origin, crumbItems));

  return (
    <>
      <JsonLd data={jsonLd} />
      <ProductClient
        initial={initial && typeof initial.slug === 'string' ? (initial as ProductDetail) : null}
        relatedSlot={
          <Suspense fallback={null}>
            <PdpRelatedSlot
              id={publicProductId(initial) || ''}
              slug={initial.slug}
              categorySlug={categorySlug}
              categoryName={product.category?.name || null}
            />
          </Suspense>
        }
      />
    </>
  );
}

/** Related rail streams after the product shell. The client shelf already refetches this catalog. */
async function PdpRelatedSlot({
  id,
  slug,
  categorySlug,
  categoryName,
}: {
  id: string;
  slug: string;
  categorySlug: string | null;
  categoryName?: string | null;
}) {
  const related = await fetchRelatedCatalogProducts({ id, slug, categorySlug });
  return (
    <PdpRelatedProducts
      productId={id}
      productSlug={slug}
      categorySlug={categorySlug}
      categoryName={categoryName}
      initial={related.items as Product[]}
      initialKind={related.kind}
    />
  );
}
