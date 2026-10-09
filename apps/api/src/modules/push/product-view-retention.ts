/**
 * Retenção LGPD dos "produtos vistos" (lembrete por push) — 90 dias.
 * Apaga ProductViewEvent (lastViewedAt) e AbandonedViewPush (sentAt) mais antigos que o prazo.
 * Idempotente: rodar de novo não apaga nada além do que já passou do prazo.
 * Os limites do lembrete (48 h de idade máx. da visita, 7 dias de cap por produto) ficam bem dentro dos 90 dias.
 */
import type { PrismaClient } from '@prisma/client';

export const PRODUCT_VIEW_RETENTION_DAYS = 90;
export const PRODUCT_VIEW_RETENTION_EVERY_MS = 6 * 60 * 60 * 1000;
export const PRODUCT_VIEW_RETENTION_BATCH = 5000;

export function productViewRetentionCutoff(now: Date, days = PRODUCT_VIEW_RETENTION_DAYS): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/** Roda no máximo a cada 6 h por processo (o job de push chama a cada 30 s). */
export function productViewRetentionDue(lastRunAt: number | null, nowMs: number): boolean {
  return lastRunAt === null || nowMs - lastRunAt >= PRODUCT_VIEW_RETENTION_EVERY_MS;
}

type Db = Pick<PrismaClient, 'productViewEvent' | 'abandonedViewPush'>;

async function deleteInBatches(
  findIds: () => Promise<{ id: string }[]>,
  del: (ids: string[]) => Promise<{ count: number }>,
): Promise<number> {
  let total = 0;
  for (let guard = 0; guard < 100; guard++) {
    const ids = (await findIds()).map((r) => r.id);
    if (!ids.length) break;
    total += (await del(ids)).count;
    if (ids.length < PRODUCT_VIEW_RETENTION_BATCH) break;
  }
  return total;
}

export async function purgeExpiredProductViews(db: Db, now = new Date()) {
  const cutoff = productViewRetentionCutoff(now);
  const views = await deleteInBatches(
    () =>
      db.productViewEvent.findMany({
        where: { lastViewedAt: { lt: cutoff } },
        select: { id: true },
        take: PRODUCT_VIEW_RETENTION_BATCH,
      }),
    (ids) => db.productViewEvent.deleteMany({ where: { id: { in: ids }, lastViewedAt: { lt: cutoff } } }),
  );
  const pushes = await deleteInBatches(
    () =>
      db.abandonedViewPush.findMany({
        where: { sentAt: { lt: cutoff } },
        select: { id: true },
        take: PRODUCT_VIEW_RETENTION_BATCH,
      }),
    (ids) => db.abandonedViewPush.deleteMany({ where: { id: { in: ids }, sentAt: { lt: cutoff } } }),
  );
  return { cutoff: cutoff.toISOString(), views, pushes };
}
