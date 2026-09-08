/**
 * Lease DB-safe para jobs multi-réplica (Prisma pool-friendly).
 * Não usa pg_advisory_lock de sessão (risco com connection pool).
 *
 * CREATE TABLE IF NOT EXISTS na primeira aquisição (idempotente).
 */
import { PrismaService } from '../../prisma.service';

export async function ensureSchedulerLockTable(prisma: PrismaService) {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SchedulerLock" (
      "id" TEXT PRIMARY KEY,
      "holder" TEXT NOT NULL,
      "expiresAt" TIMESTAMPTZ NOT NULL
    )
  `);
}

/**
 * Tenta adquirir lease. Retorna true se este processo venceu.
 * TTL curto (ex. 50s) — se o processo cair, outro réplica pega no próximo ciclo.
 */
export async function tryAcquireSchedulerLock(
  prisma: PrismaService,
  lockId: string,
  holder: string,
  ttlMs: number,
): Promise<boolean> {
  await ensureSchedulerLockTable(prisma);
  const expiresAt = new Date(Date.now() + ttlMs);
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    INSERT INTO "SchedulerLock" ("id", "holder", "expiresAt")
    VALUES (${lockId}, ${holder}, ${expiresAt})
    ON CONFLICT ("id") DO UPDATE
      SET "holder" = EXCLUDED."holder",
          "expiresAt" = EXCLUDED."expiresAt"
      WHERE "SchedulerLock"."expiresAt" < NOW()
         OR "SchedulerLock"."holder" = ${holder}
    RETURNING "id"
  `;
  return rows.length > 0;
}

export async function releaseSchedulerLock(
  prisma: PrismaService,
  lockId: string,
  holder: string,
): Promise<void> {
  await prisma.$executeRaw`
    DELETE FROM "SchedulerLock"
    WHERE "id" = ${lockId} AND "holder" = ${holder}
  `;
}
