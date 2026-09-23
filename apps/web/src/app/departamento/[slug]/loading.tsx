import { ProductGridSkeleton } from '@/components/Skeleton';

/** Instant shell for department taps. The catalog itself still loads in the client. */
export default function Loading() {
  return (
    <div style={{ paddingTop: 18 }}>
      <ProductGridSkeleton count={6} />
    </div>
  );
}
