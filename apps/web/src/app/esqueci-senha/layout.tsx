import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ESQUECI_SENHA_SEO, storefrontPageMetadata } from '@/lib/seo-metadata';

export const metadata: Metadata = storefrontPageMetadata(ESQUECI_SENHA_SEO);

export default function EsqueciSenhaLayout({ children }: { children: ReactNode }) {
  return children;
}
