import { OrderStatus } from '@prisma/client';

/** Pedidos que comprovam compra e liberam avaliação. */
export const REVIEW_ELIGIBLE_STATUSES: OrderStatus[] = [
  OrderStatus.paid,
  OrderStatus.organizing,
  OrderStatus.packing,
  OrderStatus.ready_for_pickup,
  OrderStatus.in_transit,
  OrderStatus.delivered,
  OrderStatus.separating,
  OrderStatus.shipped,
];

export function isReviewEligibleStatus(status: string): boolean {
  return (REVIEW_ELIGIBLE_STATUSES as string[]).includes(status);
}

/** Recalcula média/contagem a partir de ratings publicados. */
export function aggregatePublishedRatings(ratings: number[]): { avg: number; count: number } {
  const count = ratings.length;
  if (count === 0) return { avg: 0, count: 0 };
  const sum = ratings.reduce((a, b) => a + b, 0);
  const avg = Math.round((sum / count) * 100) / 100;
  return { avg, count };
}
