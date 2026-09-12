import type { Metadata } from 'next';
import DepartamentoClient from './DepartamentoClient';
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

export default function Page() {
  return <DepartamentoClient />;
}
