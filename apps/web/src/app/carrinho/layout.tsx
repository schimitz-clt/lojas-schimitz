import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SACOLA_SEO, storefrontPageMetadata } from '@/lib/seo-metadata';

export const metadata: Metadata = storefrontPageMetadata(SACOLA_SEO);

export default function CarrinhoLayout({ children }: { children: ReactNode }) {
  return children;
}
