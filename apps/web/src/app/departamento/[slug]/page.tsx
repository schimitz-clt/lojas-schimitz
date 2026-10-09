import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import DepartamentoClient from './DepartamentoClient';
import type { Product } from '@/components/ProductCard';
import { JsonLd } from '@/components/JsonLd';
import { ProductGridSkeleton } from '@/components/Skeleton';
import { buildBreadcrumbList } from '@/lib/json-ld';
import { missingPageMetadata, storefrontPageMetadata } from '@/lib/seo-metadata';
import { fetchCategoryMeta, fetchStoreSettings, siteOrigin } from '@/lib/storefront';
import { resolveApiProxyTarget } from '@/lib/api-proxy';
import {
  departmentQueryPath,
  departmentSeo,
  parseDepartmentList,
  type DepartmentInitialList,
} from '@/lib/department-page';

type SearchParams = Record<string, string | string[] | undefined>;
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> };

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [cat, store] = await Promise.all([fetchCategoryMeta(slug), fetchStoreSettings()]);
  const seo = departmentSeo(slug, cat, store.siteTitle);
  if (seo.notFound) return missingPageMetadata();
  return storefrontPageMetadata({
    title: seo.title,
    description: seo.description,
    path: `/departamento/${encodeURIComponent(slug)}`,
    siteName: store.siteTitle,
    origin: siteOrigin(),
  });
}

/**
 * First page of the grid rendered on the server, so crawlers and the first paint see the products
 * (before: the HTML only had the skeleton; everything loaded in the client). Failure → the client
 * fetches as before.
 */
async function fetchInitialList(path: string): Promise<DepartmentInitialList<Product> | null> {
  try {
    const res = await fetch(`${resolveApiProxyTarget()}/api/v1${path}`, {
      next: { revalidate: 60 },
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    return parseDepartmentList<Product>(path, await res.json());
  } catch {
    return null;
  }
}

export default async function Page({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const path = departmentQueryPath({
    slug,
    minPrice: first(sp.minPrice),
    maxPrice: first(sp.maxPrice),
    sort: first(sp.sort),
    page: first(sp.page),
  });

  return (
    <>
      <Suspense fallback={null}>
        <DepartmentJsonLd slug={slug} />
      </Suspense>
      <Suspense fallback={<ProductGridSkeleton count={6} />}>
        <DepartmentGrid path={path} />
      </Suspense>
    </>
  );
}

async function DepartmentGrid({ path }: { path: string }) {
  const initial = await fetchInitialList(path);
  return <DepartamentoClient initial={initial} />;
}

/** Breadcrumb name follows the categories API without holding the product grid. */
async function DepartmentJsonLd({ slug }: { slug: string }) {
  const cat = await fetchCategoryMeta(slug);
  const seo = departmentSeo(slug, cat, 'Lojas Schimitz');
  if (seo.notFound) notFound();
  const origin = siteOrigin();
  const breadcrumb = buildBreadcrumbList(origin, [
    { name: 'Início', path: '/' },
    { name: 'Produtos', path: '/produtos' },
    { name: seo.title, path: `/departamento/${encodeURIComponent(slug)}` },
  ]);
  return <JsonLd data={breadcrumb} />;
}
