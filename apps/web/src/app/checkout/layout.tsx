import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { CHECKOUT_SEO, storefrontPageMetadata } from '@/lib/seo-metadata';

export const metadata: Metadata = storefrontPageMetadata(CHECKOUT_SEO);

export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return children;
}
