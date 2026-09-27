/**
 * Legacy backfill — tests on a DISPOSABLE local database (created with every migration, dropped at
 * the end). Proves: dry-run writes nothing; apply is INSERT-only (Payment/Order/Inventory rows are
 * byte-identical before/after, incl. financialState/updatedAt); re-run inserts nothing; payments with
 * live history get no new transitions; the live recorder keeps working after the backfill; findings
 * become FinancialDiscrepancy rows only; no provider code is reachable from the backfill.
 */
import assert from 'assert';
import { execFileSync, spawnSync } from 'child_process';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { runLegacyBackfill } from './legacy-backfill';
import { FinancialRecorder } from './financial-recorder.service';

const url = new URL(process.env.DATABASE_URL || 'postgresql://schimitz:schimitz@127.0.0.1:5432/lojas_schimitz_fin');
if (!/^(127\.0\.0\.1|localhost)$/.test(url.hostname)) throw new Error('RECUSADO: somente Postgres local');
const env = { ...process.env, PGPASSWORD: decodeURIComponent(url.password), PGHOST: url.hostname, PGPORT: url.port || '5432', PGUSER: decodeURIComponent(url.username) };
const MIG_DIR = join(__dirname, '../../../../../prisma/migrations');

function psql(db: string, args: string[]) {
  const r = spawnSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-d', db, ...args], { env, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`psql failed: ${r.stderr}`);
  return r.stdout.trim();
}
const sql = (db: string, q: string) => psql(db, ['-Atc', q]);

async function main() {
  // Static guarantees: the backfill never updates/deletes and never touches the payment provider.
  const src = readFileSync(join(__dirname, 'legacy-backfill.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  for (const bad of [/\.update\(/, /\.updateMany\(/, /\.upsert\(/, /\.delete(Many)?\(/, /\$executeRaw/, /payment\.provider/, /PaymentsService/, /fetch\(/, /UPDATE\s+"/i, /DELETE\s+FROM/i]) {
    assert.ok(!bad.test(src), `legacy-backfill.ts must not contain ${bad}`);
  }
  console.log('  PASS static: INSERT-only, no provider access');

  const name = `omega_backfill_${randomUUID().slice(0, 6)}`;
  execFileSync('createdb', [name], { env });
  const dbUrl = new URL(url.toString());
  dbUrl.pathname = `/${name}`;
  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl.toString() } }, log: [] });
  try {
    for (const d of readdirSync(MIG_DIR).filter((x) => /^\d/.test(x)).sort()) psql(name, ['-f', join(MIG_DIR, d, 'migration.sql')]);
    sql(name, `INSERT INTO "User" ("id","email","name","passwordHash","updatedAt") VALUES ('u1','legacy@test.local','Legacy','x',NOW())`);
    sql(name, `INSERT INTO "Order" ("id","publicId","subtotal","total","status","updatedAt","userId") VALUES
      ('o1','SCH-L1',10,10,'paid',NOW(),'u1'), ('o2','SCH-L2',10,10,'awaiting_payment',NOW(),'u1'), ('o3','SCH-L3',20,20,'refunded',NOW(),'u1'),
      ('o4','SCH-L4',10,10,'cancelled',NOW(),'u1'), ('o5','SCH-L5',30,30,'awaiting_payment',NOW(),'u1'), ('o6','SCH-L6',15,15,'paid',NOW(),'u1'),
      ('o7','SCH-L7',12,12,'paid',NOW(),'u1'), ('o8','SCH-L8',10,10,'cancelled',NOW(),'u1')`);
    sql(name, `INSERT INTO "Payment" ("id","orderId","method","status","externalId","amount","createdAt","updatedAt") VALUES
      ('p1','o1','pix','approved','MP-1',10,NOW()-interval '9 day',NOW()-interval '9 day'+interval '5 min'),
      ('p2','o2','pix','pending','MP-2',10,NOW()-interval '1 hour',NOW()-interval '1 hour'),
      ('p3','o2','card','refused',NULL,10,NOW()-interval '2 hour',NOW()-interval '2 hour'),
      ('p4','o3','pix','refunded','MP-4',20,NOW()-interval '8 day',NOW()-interval '2 day'),
      ('p5','o4','pix','expired','MP-5',10,NOW()-interval '7 day',NOW()-interval '6 day'),
      ('p6','o5','pix','approved','MP-6',30,NOW()-interval '3 day',NOW()-interval '3 day'),
      ('p7','o7','pix','approved','MP-7',12,NOW()-interval '1 day',NOW()-interval '1 day'),
      ('p8','o8','card','cancelled','MP-8',10,NOW()-interval '5 day',NOW()-interval '5 day')`);
    // p7 was tracked live by the financial core (already has history + ledger).
    sql(name, `INSERT INTO "PaymentStateTransition" ("id","paymentId","orderId","fromState","toState","source","eventKey","amount") VALUES
      ('t1','p7','o7',NULL,'PENDING','checkout','created',12), ('t2','p7','o7','PENDING','PAID','webhook','seq:2',12)`);
    sql(name, `INSERT INTO "FinancialLedgerEntry" ("id","entryType","direction","amount","paymentId","orderId","source","idempotencyKey") VALUES
      ('l1','PAYMENT_CREATED','NONE',12,'p7','o7','checkout','PAYMENT_CREATED:p7'), ('l2','PAYMENT_CAPTURED','CREDIT',12,'p7','o7','webhook','PAYMENT_CAPTURED:p7')`);

    const snap = () => sql(name, `SELECT md5(
      (SELECT string_agg(row_to_json(p)::text, '|' ORDER BY p."id") FROM "Payment" p) ||
      (SELECT string_agg(row_to_json(o)::text, '|' ORDER BY o."id") FROM "Order" o) ||
      COALESCE((SELECT string_agg(row_to_json(i)::text, '|' ORDER BY i."productId") FROM "Inventory" i), ''))`);
    const counts = () => sql(name, `SELECT (SELECT COUNT(*) FROM "PaymentStateTransition")||'/'||(SELECT COUNT(*) FROM "FinancialLedgerEntry")||'/'||(SELECT COUNT(*) FROM "FinancialDiscrepancy")||'/'||(SELECT COUNT(*) FROM "FinancialAuditEvent")`);
    const before = snap();

    // 1) dry-run
    const dry = await runLegacyBackfill(prisma, { apply: false });
    assert.equal(counts(), '2/2/0/0', 'dry-run writes nothing');
    assert.equal(dry.paymentsScanned, 8);
    assert.equal(dry.paymentsWithLiveHistory, 1);
    assert.equal(dry.transitions.planned, 14);
    assert.equal(dry.ledger.planned, 14);
    assert.deepEqual(dry.ledger.byType, { PAYMENT_CREATED: 7, PAYMENT_CAPTURED: 3, PAYMENT_FAILED: 1, PAYMENT_EXPIRED: 1, PAYMENT_CANCELLED: 1, REFUND_COMPLETED: 1 });
    const dryTypes = Object.keys(dry.discrepancies.byType).sort();
    assert.ok(dryTypes.includes('APPROVED_ORDER_NOT_PAID') && dryTypes.includes('ORDER_PAID_WITHOUT_PAYMENT'), dryTypes.join(','));
    assert.ok(!dryTypes.some((t) => t.startsWith('LEDGER_')), `dry-run simulates the planned ledger: ${dryTypes}`);
    console.log(`  PASS dry-run: planned transitions=${dry.transitions.planned} ledger=${dry.ledger.planned} discrepancies=${dry.discrepancies.found} (${dryTypes.join(',')}), nothing written`);

    // 2) apply
    const ap = await runLegacyBackfill(prisma, { apply: true, actor: 'spec', backupSha256: 'f'.repeat(64) });
    assert.equal(ap.transitions.inserted, 14);
    assert.equal(ap.ledger.inserted, 14);
    assert.equal(ap.discrepancies.inserted, dry.discrepancies.new);
    assert.ok(ap.auditEventId);
    assert.equal(snap(), before, 'Payment/Order/Inventory rows byte-identical (status, financialState, updatedAt untouched)');
    const chain = (pid: string) => sql(name, `SELECT string_agg(COALESCE("fromState",'∅')||'>'||"toState", ',' ORDER BY "createdAt","eventKey") FROM "PaymentStateTransition" WHERE "paymentId"='${pid}'`);
    assert.equal(chain('p1'), '∅>PENDING,PENDING>PAID');
    assert.equal(chain('p3'), '∅>CREATED,CREATED>FAILED');
    assert.equal(chain('p4'), '∅>PENDING,PENDING>PAID,PAID>REFUNDED');
    assert.equal(chain('p7'), '∅>PENDING,PENDING>PAID', 'live history untouched');
    assert.equal(sql(name, `SELECT SUM(CASE WHEN "direction"='CREDIT' THEN "amount" WHEN "direction"='DEBIT' THEN -"amount" ELSE 0 END) FROM "FinancialLedgerEntry" WHERE "paymentId"='p4'`), '0.00', 'refunded legacy nets to zero');
    assert.equal(sql(name, `SELECT COUNT(*) FROM "FinancialLedgerEntry" WHERE "paymentId"='p7'`), '2', 'no duplicate for live payment');
    assert.equal(sql(name, `SELECT "createdAt"::date = (NOW()-interval '9 day')::date FROM "FinancialLedgerEntry" WHERE "idempotencyKey"='PAYMENT_CAPTURED:p1'`), 't', 'historical timestamp kept');
    const crit = sql(name, `SELECT string_agg("type"||':'||"severity"||':'||"status", ',' ORDER BY "type") FROM "FinancialDiscrepancy" WHERE "severity"='CRITICAL'`);
    assert.ok(crit.includes('APPROVED_ORDER_NOT_PAID:CRITICAL:OPEN') && crit.includes('ORDER_PAID_WITHOUT_PAYMENT:CRITICAL:OPEN'), crit);
    assert.equal(sql(name, `SELECT COUNT(*) FROM "FinancialDiscrepancy" WHERE "type" LIKE 'LEDGER_%'`), '0');
    console.log(`  PASS apply: inserted transitions=${ap.transitions.inserted} ledger=${ap.ledger.inserted} discrepancies=${ap.discrepancies.inserted}; core rows byte-identical`);

    // 3) re-run is a no-op
    const c1 = counts();
    const again = await runLegacyBackfill(prisma, { apply: true, actor: 'spec' });
    assert.equal(again.transitions.planned + again.transitions.inserted + again.ledger.planned + again.ledger.inserted + again.discrepancies.inserted, 0);
    assert.equal(again.auditEventId, null);
    assert.equal(counts(), c1);
    assert.equal(snap(), before);
    console.log(`  PASS re-run: 0 planned, 0 inserted (counts ${c1} unchanged)`);

    // 4) live recorder after backfill: p2 gets approved later → PENDING→PAID once, capture once; backfill still no-op.
    sql(name, `UPDATE "Payment" SET "status"='approved' WHERE "id"='p2'`);
    const recorder = new FinancialRecorder(prisma as any);
    const r = await recorder.syncPaymentState('p2', { source: 'webhook', obs: { rawStatus: 'approved' } });
    assert.equal(r.applied, true);
    assert.equal(chain('p2'), '∅>PENDING,PENDING>PAID');
    assert.equal(sql(name, `SELECT COUNT(*) FROM "FinancialLedgerEntry" WHERE "idempotencyKey"='PAYMENT_CAPTURED:p2'`), '1');
    assert.equal(await recorder.recordPaymentCreated('p2', { source: 'checkout' }), false, 'created already recorded by backfill');
    const post = await runLegacyBackfill(prisma, { apply: true });
    assert.equal(post.transitions.inserted + post.ledger.inserted, 0);
    console.log('  PASS live recorder keeps working after backfill (no key collisions); backfill stays a no-op');
    console.log('legacy-backfill.db.spec PASS');
  } finally {
    await prisma.$disconnect();
    spawnSync('dropdb', ['--if-exists', name], { env });
  }
}

main().catch((e) => { console.error('legacy-backfill.db.spec FAIL', e); process.exit(1); });
