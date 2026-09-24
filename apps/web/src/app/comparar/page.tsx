import type { Metadata } from 'next';
import CompararClient from './CompararClient';
import { COMPARAR_SEO, storefrontPageMetadata } from '@/lib/seo-metadata';

export const metadata: Metadata = storefrontPageMetadata(COMPARAR_SEO);

export default function Page() {
  return <CompararClient />;
}
