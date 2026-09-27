/**
 * COMANDO OMEGA — migration safety test on DISPOSABLE local databases (created and dropped here).
 *  1. Replays every existing migration, then inserts legacy data INCLUDING duplicate
 *     (provider, externalId) payments, then applies 20260927_financial_core.
 *     => must not fail, must not touch existing rows, must SKIP the unique index (NOTICE).
 *  2. Re-applying the migration is a no-op (IF NOT EXISTS everywhere).
 *  3. Without duplicates the unique index is created.
 * Never touches the main test DB or any remote database.
 */
import assert from 'assert';
import { execFileSync, spawnSync } from 'child_process';
import { readdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

const url = new URL(process.env.DATABASE_URL || 'postgresql://schimitz:schimitz@127.0.0.1:5432/lojas_schimitz_fin');
if (!/^(127\.0\.0\.1|localhost)$/.test(url.hostname)) throw new Error('RECUSADO: somente Postgres local');
const env = { ...process.env, PGPASSWORD: decodeURIComponent(url.password), PGHOST: url.hostname, PGPORT: url.port || '5432', PGUSER: decodeURIComponent(url.username) };
const MIG_DIR = join(__dirname, '../../../../../prisma/migrations');
const FINANCIAL = '20260927_financial_core';

function psql(db: string, args: string[]) {
  const r = spawnSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-d', db, ...args], { env, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`psql failed: ${r.stderr}`);
  return { out: r.stdout.trim(), err: r.stderr };
}
const sql = (db: string, q: string) => psql(db, ['-Atc', q]).out;

function freshDb(tag: string) {
  const name = `omega_migtest_${tag}_${randomUUID().slice(0, 6)}`;
  execFileSync('createdb', [name], { env });
  const dirs = readdirSync(MIG_DIR).filter((d) => /^\d/.test(d)).sort();
  for (const d of dirs) {
    if (d === FINANCIAL) break;
    psql(name, ['-f', join(MIG_DIR, d, 'migration.sql')]);
  }
  return name;
}
function seedLegacy(db: string, duplicate: boolean) {
  sql(db, `INSERT INTO "User" ("id","email","name","passwordHash","updatedAt") VALUES ('u1','legacy@test.local','Legacy','x',NOW())`);
  sql(db, `INSERT INTO "Order" ("id","publicId","subtotal","total","updatedAt","userId") VALUES ('o1','SCH-LEGACY-1',10,10,NOW(),'u1'), ('o2','SCH-LEGACY-2',10,10,NOW(),'u1')`);
  sql(db, `INSERT INTO "Payment" ("id","orderId","method","status","externalId","amount","updatedAt") VALUES
    ('p1','o1','pix','approved','MP-111',10,NOW()),
    ('p2','o2','pix','pending','${duplicate ? 'MP-111' : 'MP-222'}',10,NOW()),
    ('p3','o2','card','refused',NULL,10,NOW())`);
}
const snapshot = (db: string) => sql(db, `SELECT string_agg("id"||':'||"status"||':'||COALESCE("externalId",'-')||':'||"amount", ',' ORDER BY "id") FROM "Payment"`);
const hasIndex = (db: string) => sql(db, `SELECT COUNT(*) FROM pg_indexes WHERE indexname = 'Payment_provider_externalId_unique'`) === '1';

const created: string[] = [];
try {
  // 1) duplicates present
  const a = freshDb('dup');
  created.push(a);
  seedLegacy(a, true);
  const before = snapshot(a);
  const r = psql(a, ['-f', join(MIG_DIR, FINANCIAL, 'migration.sql')]);
  assert.ok(/Payment_provider_externalId_unique SKIPPED: 1 duplicate/.test(r.err), `expected NOTICE, got: ${r.err}`);
  assert.equal(hasIndex(a), false, 'unique index must be skipped when duplicates exist');
  assert.equal(snapshot(a), before, 'existing payment rows untouched');
  assert.equal(sql(a, `SELECT COUNT(*) FROM "Payment" WHERE "financialState" IS NULL`), '3', 'new columns nullable, legacy rows not rewritten');
  assert.equal(sql(a, `SELECT to_regclass('"FinancialLedgerEntry"') IS NOT NULL`), 't');
  // 2) idempotent re-apply
  psql(a, ['-f', join(MIG_DIR, FINANCIAL, 'migration.sql')]);
  assert.equal(snapshot(a), before);
  console.log('  PASS migration with duplicate externalId: applied, index SKIPPED with NOTICE, data untouched, re-apply ok');

  // 3) clean data → index created and enforced
  const b = freshDb('clean');
  created.push(b);
  seedLegacy(b, false);
  psql(b, ['-f', join(MIG_DIR, FINANCIAL, 'migration.sql')]);
  assert.equal(hasIndex(b), true);
  assert.throws(() => sql(b, `INSERT INTO "Payment" ("id","orderId","method","externalId","amount","updatedAt") VALUES ('p9','o1','pix','MP-111',1,NOW())`), /duplicate key|unique/i);
  // append-only guard active
  sql(b, `INSERT INTO "FinancialAuditEvent" ("id","action","origin") VALUES ('a1','test','test')`);
  assert.throws(() => sql(b, `UPDATE "FinancialAuditEvent" SET "action"='x' WHERE "id"='a1'`), /append-only/);
  assert.throws(() => sql(b, `DELETE FROM "FinancialAuditEvent" WHERE "id"='a1'`), /append-only/);
  console.log('  PASS migration on clean data: unique index created + enforced; append-only triggers active');
  console.log('migration.db.spec PASS');
} finally {
  for (const db of created) spawnSync('dropdb', ['--if-exists', db], { env });
}
