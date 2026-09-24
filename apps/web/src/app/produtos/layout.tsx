import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { PRODUTOS_SEO, storefrontPageMetadata } from '@/lib/seo-metadata';

export const metadata: Metadata = storefrontPageMetadata(PRODUTOS_SEO);

export default function ProdutosLayout({ children }: { children: ReactNode }) {
  return children;
}
