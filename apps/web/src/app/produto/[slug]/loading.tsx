import { PdpSkeleton } from '@/components/Skeleton';

/** Instant shell while the product RSC is still in flight (Next.js 15 dynamic prefetch). */
export default function Loading() {
  return <PdpSkeleton />;
}
