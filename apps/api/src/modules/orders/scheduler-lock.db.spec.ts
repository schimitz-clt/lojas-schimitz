/**
 * Postgres local only — never Railway.
 * DATABASE_URL default: lojas_schimitz_sch005
 */
import assert from 'assert';
import { PrismaClient } from '@prisma/client';
import { releaseSchedulerLock, tryAcquireSchedulerLock } from './scheduler-lock';

const url =
  process.env.DATABASE_URL ||
  'postgresql://schimitz:schimitz@127.0.0.1:5432/lojas_schimitz_sch005?schema=public';

async function main() {
  if (/railway|rlwy|proxy\.rlwy/i.test(url)) {
    throw new Error('Refuse Railway URL in local DB test');
  }
  process.env.DATABASE_URL = url;
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    const lockId = `test-expire-${Date.now()}`;
    const a = await tryAcquireSchedulerLock(prisma as any, lockId, 'holder-a', 30_000);
    assert.equal(a, true, 'first acquire');
    const b = await tryAcquireSchedulerLock(prisma as any, lockId, 'holder-b', 30_000);
    assert.equal(b, false, 'second holder blocked');
    await releaseSchedulerLock(prisma as any, lockId, 'holder-a');
    const c = await tryAcquireSchedulerLock(prisma as any, lockId, 'holder-b', 30_000);
    assert.equal(c, true, 'after release');
    await releaseSchedulerLock(prisma as any, lockId, 'holder-b');
    await prisma.$executeRaw`DELETE FROM "SchedulerLock" WHERE "id" = ${lockId}`;
    console.log('scheduler-lock.db.spec.ts OK');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
