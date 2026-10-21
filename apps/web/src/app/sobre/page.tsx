import type { Metadata } from 'next';
import { InstitutionalPage } from '@/components/institutional/InstitutionalPage';
import { SOBRE_SECTIONS, SOBRE_SEO } from '@/lib/institutional-pages';
import { storefrontPageMetadata } from '@/lib/seo-metadata';

export const metadata: Metadata = storefrontPageMetadata(SOBRE_SEO);

export default function SobrePage() {
  return <InstitutionalPage title="Sobre a Lojas Schimitz" sections={SOBRE_SECTIONS} />;
}
