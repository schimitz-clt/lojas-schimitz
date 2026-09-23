import type { Metadata } from 'next';
import { Suspense } from 'react';
import DepartamentoClient from './DepartamentoClient';
import { JsonLd } from '@/components/JsonLd';
import { ProductGridSkeleton } from '@/components/Skeleton';
import { buildBreadcrumbList } from '@/lib/json-ld';
import { fetchCategoryMeta, fetchStoreSettings, siteOrigin } from '@/lib/storefront';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [cat, store] = await Promise.all([fetchCategoryMeta(slug), fetchStoreSettings()]);
  const base = siteOrigin();
  const path = `/departamento/${encodeURIComponent(slug)}`;
  const title = cat?.name || slug;
  const description =
    cat?.description ||
    `${title} na ${store.siteTitle} — catálogo em Porto Alegre.`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${base}${path}`,
      siteName: store.siteTitle,
    },
  };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;

  return (
    <>
      <Suspense fallback={null}>
        <DepartmentJsonLd slug={slug} />
      </Suspense>
      <Suspense fallback={<ProductGridSkeleton count={6} />}>
        <DepartamentoClient />
      </Suspense>
    </>
  );
}

/** Breadcrumb name follows the categories API without holding the product grid. */
async function DepartmentJsonLd({ slug }: { slug: string }) {
  const cat = await fetchCategoryMeta(slug);
  const origin = siteOrigin();
  const name = cat?.name || slug;
  const breadcrumb = buildBreadcrumbList(origin, [
    { name: 'Início', path: '/' },
    { name: 'Produtos', path: '/produtos' },
    { name, path: `/departamento/${encodeURIComponent(slug)}` },
  ]);
  return <JsonLd data={breadcrumb} />;
}
