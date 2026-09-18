import type { Metadata } from 'next';
import CompararClient from './CompararClient';

export const metadata: Metadata = {
  title: 'Comparar produtos',
  description: 'Compare até 3 produtos da Lojas Schimitz — preço, PIX, parcelas, estoque e categoria.',
  alternates: { canonical: '/comparar' },
  robots: { index: false, follow: true },
};

export default function Page() {
  return <CompararClient />;
}
