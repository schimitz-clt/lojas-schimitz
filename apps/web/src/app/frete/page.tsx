import type { Metadata } from 'next';
import { InstitutionalPage } from '@/components/institutional/InstitutionalPage';
import { FRETE_SECTIONS, FRETE_SEO } from '@/lib/institutional-pages';
import { storefrontPageMetadata } from '@/lib/seo-metadata';

export const metadata: Metadata = storefrontPageMetadata(FRETE_SEO);

export default function FretePage() {
  return <InstitutionalPage title="Frete e entrega" sections={FRETE_SECTIONS} />;
}
