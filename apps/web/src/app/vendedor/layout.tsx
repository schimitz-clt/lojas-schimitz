import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { VENDEDOR_SEO, storefrontPageMetadata } from '@/lib/seo-metadata';

export const metadata: Metadata = storefrontPageMetadata(VENDEDOR_SEO);

export default function VendedorLayout({ children }: { children: ReactNode }) {
  return children;
}
