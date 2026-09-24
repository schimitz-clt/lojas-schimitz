import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SALVOS_SEO, storefrontPageMetadata } from '@/lib/seo-metadata';

export const metadata: Metadata = storefrontPageMetadata(SALVOS_SEO);

export default function FavoritosLayout({ children }: { children: ReactNode }) {
  return children;
}
