import type { Metadata } from 'next';
import { InstitutionalPage } from '@/components/institutional/InstitutionalPage';
import { TROCAS_SECTIONS, TROCAS_SEO } from '@/lib/institutional-pages';
import { storefrontPageMetadata } from '@/lib/seo-metadata';

export const metadata: Metadata = storefrontPageMetadata(TROCAS_SEO);

export default function TrocasPage() {
  return <InstitutionalPage title="Trocas e devoluções" sections={TROCAS_SECTIONS} />;
}
