/**
 * CLI: legacy ledger/state-history backfill (see legacy-backfill.ts for guarantees).
 *
 *   DATABASE_URL=... npx tsx src/modules/finance/legacy-backfill.cli.ts            # dry-run (default)
 *   DATABASE_URL=... FINANCE_BACKFILL_BACKUP_SHA256=<sha of fresh pg_dump> \
 *     npx tsx src/modules/finance/legacy-backfill.cli.ts --apply                   # apply
 *
 * Standalone PrismaClient (does NOT boot the Nest app → no schedulers/jobs run against the DB).
 * Output: counts + discrepancy list (ids, types, messages). Never prints connection strings.
 */
import { PrismaClient } from '@prisma/client';
import { runLegacyBackfill } from './legacy-backfill';

async function main() {
  const apply = process.argv.includes('--apply');
  const url = process.env.DATABASE_URL || '';
  if (!url) throw new Error('DATABASE_URL obrigatória');
  const local = /@(127\.0\.0\.1|localhost)[:/]/.test(url);
  if (apply && !local && !/^[0-9a-f]{64}$/.test(process.env.FINANCE_BACKFILL_BACKUP_SHA256 || '')) {
    throw new Error('Apply em banco não-local exige FINANCE_BACKFILL_BACKUP_SHA256 (sha256 do pg_dump recém-feito).');
  }
  const prisma = new PrismaClient({ log: ['error'] });
  try {
    const summary = await runLegacyBackfill(prisma, { apply, actor: process.env.FINANCE_BACKFILL_ACTOR || 'cli', backupSha256: process.env.FINANCE_BACKFILL_BACKUP_SHA256 || null });
    console.log(JSON.stringify({ target: local ? 'local' : 'remote', backupSha256: process.env.FINANCE_BACKFILL_BACKUP_SHA256 || null, ...summary }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('BACKFILL_FAILED', String(e?.message || e).slice(0, 500));
  process.exit(1);
});
