import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SUPORTE_SEO, storefrontPageMetadata } from '@/lib/seo-metadata';

export const metadata: Metadata = storefrontPageMetadata(SUPORTE_SEO);

export default function SuporteLayout({ children }: { children: ReactNode }) {
  return children;
}
