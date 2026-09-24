import type { Metadata } from 'next';
import HomePage from './home-client';

/** Homepage only. Other routes set their own canonical so they do not inherit `/`. */
export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default function Page() {
  return <HomePage />;
}
