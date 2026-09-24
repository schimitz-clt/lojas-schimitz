import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ENTRAR_SEO, storefrontPageMetadata } from '@/lib/seo-metadata';

export const metadata: Metadata = storefrontPageMetadata(ENTRAR_SEO);

export default function EntrarLayout({ children }: { children: ReactNode }) {
  return children;
}
