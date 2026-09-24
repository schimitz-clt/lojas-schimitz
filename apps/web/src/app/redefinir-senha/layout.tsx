import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { REDEFINIR_SENHA_SEO, storefrontPageMetadata } from '@/lib/seo-metadata';

export const metadata: Metadata = storefrontPageMetadata(REDEFINIR_SENHA_SEO);

export default function RedefinirSenhaLayout({ children }: { children: ReactNode }) {
  return children;
}
