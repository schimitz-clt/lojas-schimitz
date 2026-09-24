import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { PEDIDOS_SEO, storefrontPageMetadata } from '@/lib/seo-metadata';

export const metadata: Metadata = storefrontPageMetadata(PEDIDOS_SEO);

export default function PedidosLayout({ children }: { children: ReactNode }) {
  return children;
}
