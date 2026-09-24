import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { CADASTRO_SEO, storefrontPageMetadata } from '@/lib/seo-metadata';

export const metadata: Metadata = storefrontPageMetadata(CADASTRO_SEO);

export default function CadastroLayout({ children }: { children: ReactNode }) {
  return children;
}
