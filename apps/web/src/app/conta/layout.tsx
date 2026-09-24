import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { CONTA_SEO, storefrontPageMetadata } from '@/lib/seo-metadata';

export const metadata: Metadata = storefrontPageMetadata(CONTA_SEO);

export default function ContaLayout({ children }: { children: ReactNode }) {
  return children;
}
