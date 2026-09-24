import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NOTIFICACOES_SEO, storefrontPageMetadata } from '@/lib/seo-metadata';

export const metadata: Metadata = storefrontPageMetadata(NOTIFICACOES_SEO);

export default function NotificacoesLayout({ children }: { children: ReactNode }) {
  return children;
}
