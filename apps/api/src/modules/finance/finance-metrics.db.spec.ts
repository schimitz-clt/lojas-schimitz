/**
 * Persistent financial metrics (FinanceMetricCounter). Real local Postgres only, real Nest DI.
 *  M01 day bucket (America/Sao_Paulo)            M05 multi-replica: 4 processes × 500 on the same row
 *  M02 flush persists deltas (atomic upsert)     M06 SIGTERM (Railway redeploy) flushes, exits normally
 *  M03 1000 concurrent inc + 40 concurrent flush M07 DB/table unavailable → requeue, no throw, recovers
 *  M04 survives a simulated restart              M08 real flow → /admin/finance/health `persisted`
 *  M09 kill switch FINANCE_METRICS_PERSIST=false
 */
import assert from 'assert';
import { spawn } from 'child_process';
import { join } from 'path';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';

function assertLocalDb() {
  const url = process.env.DATABASE_URL || '';
  if (!url) throw new Error('DATABASE_URL obrigatória');
  if (/railway|rlwy|\.internal|prod/i.test(url)) throw new Error('RECUSADO: DATABASE_URL parece produção');
  if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error('RECUSADO: DATABASE_URL deve ser local');
}

const results: { id: string; ok: boolean }[] = [];
async function scenario(id: string, name: string, fn: () => Promise<string | void>) {
  const t0 = Date.now();
  try {
    const d = await fn();
    results.push({ id, ok: true });
    console.log(`  PASS ${id} ${name}${d ? ' — ' + d : ''} (${Date.now() - t0}ms)`);
  } catch (e: any) {
    results.push({ id, ok: false });
    console.log(`  FAIL ${id} ${name}\n${String(e?.stack || e).slice(0, 1500)}`);
  }
}

function runChild(args: string[], opts: { sigtermAfterReady?: boolean; env?: Record<string, string> } = {}) {
  return new Promise<{ code: number | null; signal: NodeJS.Signals | null; out: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [require.resolve('tsx/cli'), join(__dirname, 'testing', 'metrics-replica.child.ts'), ...args], {
      env: { ...process.env, ...(opts.env ?? {}) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (b) => {
      out += String(b);
      if (opts.sigtermAfterReady && out.includes('READY')) child.kill('SIGTERM');
    });
    child.stderr.on('data', (b) => { out += String(b); });
    const t = setTimeout(() => { child.kill('SIGKILL'); reject(new Error(`child timeout: ${out.slice(-500)}`)); }, 60_000);
    child.on('exit', (code, signal) => { clearTimeout(t); resolve({ code, signal, out }); });
  });
}

async function main() {
  assertLocalDb();
  process.env.FINANCE_METRICS_FLUSH_MS = '60000'; // tests flush explicitly
  const { PrismaService } = await import('../../prisma.service');
  const { FinanceMetricsStore } = await import('./finance-metrics.store');
  const { financeMetrics, saoPauloDay } = await import('./finance-metrics');

  @Module({ providers: [PrismaService, FinanceMetricsStore] })
  class StoreModule {}
  const boot = () => NestFactory.createApplicationContext(StoreModule, { logger: false });

  let app: INestApplicationContext = await boot();
  let prisma = app.get(PrismaService);
  let store = app.get(FinanceMetricsStore);
  const today = saoPauloDay();
  const dbValue = async (name: string, day = today) => {
    const r = await prisma.$queryRaw<{ v: bigint | null }[]>`SELECT SUM("value")::bigint AS v FROM "FinanceMetricCounter" WHERE "name" = ${name} AND "day" = ${day}::date`;
    return Number(r[0]?.v ?? 0);
  };
  // Start from a clean in-memory state (other imports may have counted at load time).
  await store.flush();
  financeMetrics.reset();

  console.log('Finance metrics persistence scenarios:');

  await scenario('M01', 'Bucket diário no fuso America/Sao_Paulo (virada 03:00Z)', async () => {
    assert.equal(saoPauloDay(new Date('2026-09-27T02:59:59Z')), '2026-09-26');
    assert.equal(saoPauloDay(new Date('2026-09-27T03:00:00Z')), '2026-09-27');
    assert.equal(saoPauloDay(new Date('2026-01-01T02:00:00Z')), '2025-12-31');
  });

  await scenario('M02', 'flush grava deltas (upsert atômico value = value + delta) e esvazia a fila', async () => {
    const b = await dbValue('refunds_requested');
    financeMetrics.inc('refunds_requested');
    financeMetrics.inc('refunds_requested', 2);
    assert.equal(financeMetrics.peekPending().find((d) => d.name === 'refunds_requested')?.delta, 3);
    const rows = await store.flush();
    assert.equal(rows, 1);
    assert.equal(financeMetrics.peekPending().length, 0);
    assert.equal(await dbValue('refunds_requested'), b + 3);
    financeMetrics.inc('refunds_requested');
    await store.flush();
    assert.equal(await dbValue('refunds_requested'), b + 4);
    return `db ${b} → ${b + 4}`;
  });

  await scenario('M03', '1000 inc concorrentes + 40 flush concorrentes → total exato, nada perdido/duplicado', async () => {
    const b = await dbValue('webhook_received');
    const ops: Promise<unknown>[] = [];
    for (let i = 0; i < 1000; i++) {
      ops.push(new Promise<void>((r) => setImmediate(() => { financeMetrics.inc('webhook_received'); r(); })));
      if (i % 25 === 0) ops.push(store.flush());
    }
    await Promise.all(ops);
    await store.flush();
    assert.equal(await dbValue('webhook_received'), b + 1000);
    return `+1000 exact (flushes=${store.stats.flushes})`;
  });

  await scenario('M04', 'Sobrevive a reinício simulado (close → processo "novo" → valores no banco)', async () => {
    const b = await dbValue('payments_paid');
    for (let i = 0; i < 7; i++) financeMetrics.inc('payments_paid');
    await app.close(); // graceful shutdown flushes (onModuleDestroy)
    financeMetrics.reset(); // new process: in-memory counters and queue are gone
    app = await boot();
    prisma = app.get(PrismaService);
    store = app.get(FinanceMetricsStore);
    assert.equal(financeMetrics.snapshot().counters.payments_paid, 0, 'process counter restarted from 0');
    const p = await store.persisted();
    assert.equal(p.available, true);
    assert.equal(await dbValue('payments_paid'), b + 7);
    assert.ok(p.today.counters.payments_paid >= 7);
    assert.ok(p.allTime.counters.payments_paid >= p.last7Days.counters.payments_paid);
    return `process=0, persisted today=${p.today.counters.payments_paid}`;
  });

  await scenario('M05', '4 réplicas (processos) × 500 inc no MESMO contador/dia em paralelo → soma exata', async () => {
    const b = await dbValue('provider_errors');
    const runs = await Promise.all(Array.from({ length: 4 }, () => runChild(['burst', 'provider_errors', '500'])));
    for (const r of runs) assert.equal(r.code, 0, r.out.slice(-800));
    assert.equal(await dbValue('provider_errors'), b + 2000);
    return `+2000 exact across 4 processes`;
  });

  await scenario('M06', 'SIGTERM (redeploy Railway): flush antes de sair, sai pelo sinal (comportamento padrão)', async () => {
    const b = await dbValue('reconciliation_runs');
    const r = await runChild(['sigterm', 'reconciliation_runs', '42'], { sigtermAfterReady: true });
    // Direct node child reports signal=SIGTERM; through the tsx wrapper it is exit code 143 (128+15).
    assert.ok(r.signal === 'SIGTERM' || r.code === 143, `exit code=${r.code} signal=${r.signal} out=${r.out.slice(-500)}`);
    assert.equal(await dbValue('reconciliation_runs'), b + 42);
    return `exited by SIGTERM (signal=${r.signal}, code=${r.code}), +42 persisted`;
  });

  await scenario('M07', 'Tabela indisponível (antes da migration / banco fora) → não lança, re-enfileira, recupera', async () => {
    const b = await dbValue('webhook_failures');
    financeMetrics.inc('webhook_failures', 5);
    await prisma.$executeRawUnsafe('ALTER TABLE "FinanceMetricCounter" RENAME TO "FinanceMetricCounter_tmp_m07"');
    try {
      assert.equal(await store.flush(), 0);
      assert.equal(store.stats.failures >= 1, true);
      financeMetrics.inc('webhook_failures', 2);
      assert.equal(financeMetrics.peekPending().find((d) => d.name === 'webhook_failures')?.delta, 7);
      const p = await store.persisted();
      assert.equal(p.available, false);
      assert.equal(p.today.counters.webhook_failures, 7, 'unflushed deltas still visible');
    } finally {
      await prisma.$executeRawUnsafe('ALTER TABLE "FinanceMetricCounter_tmp_m07" RENAME TO "FinanceMetricCounter"');
    }
    assert.equal(await store.flush(), 1);
    assert.equal(await dbValue('webhook_failures'), b + 7);
    return `requeued 7, persisted after recovery (flush failures=${store.stats.failures})`;
  });

  await app.close();
  financeMetrics.reset();

  await scenario('M08', 'Fluxo real (reconciliação via Nest completo) → GET health.persisted conta, sobrevive a restart', async () => {
    Object.assign(process.env, {
      APP_ENV: 'development', NODE_ENV: 'development', PAYMENTS_PROVIDER: 'null',
      FINANCE_TEST_MODE: 'true', FINANCE_RECONCILIATION_CRON_ENABLED: 'false',
      JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'omega-test-access-secret-xxxxxxxx',
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'omega-test-refresh-secret-xxxxxxx',
    });
    delete process.env.FINANCE_REFUNDS_ENABLED;
    const { AppModule } = await import('../../app.module');
    const { ReconciliationService } = await import('./reconciliation.service');
    const { FinanceAdminService } = await import('./finance-admin.service');
    const { PrismaService: PS } = await import('../../prisma.service');
    await (async () => {
      const full = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
      await full.get(PS).$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "SchedulerLock" ("id" TEXT PRIMARY KEY, "holder" TEXT NOT NULL, "expiresAt" TIMESTAMPTZ NOT NULL)`);
      const before = (await full.get(FinanceAdminService).health()).persisted.today.counters.reconciliation_runs;
      await full.get(ReconciliationService).run({ scope: 'PERIOD', from: new Date(Date.now() - 60_000), to: new Date(), withProvider: false, origin: 'test' });
      const h = await full.get(FinanceAdminService).health();
      assert.equal(h.process.counters.reconciliation_runs, 1);
      assert.equal(h.persisted.today.counters.reconciliation_runs, before + 1, 'read-your-writes before flush');
      assert.equal(h.flags.refundsEnabled, false);
      await full.close();
      financeMetrics.reset();
      const again = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
      const h2 = await again.get(FinanceAdminService).health();
      assert.equal(h2.process.counters.reconciliation_runs, 0);
      assert.equal(h2.persisted.today.counters.reconciliation_runs, before + 1, 'persisted across restart');
      await again.close();
      return undefined;
    })();
    return 'reconciliation_runs persisted and visible in health() after restart';
  });

  await scenario('M09', 'FINANCE_METRICS_PERSIST=false → nenhuma escrita (kill switch)', async () => {
    process.env.FINANCE_METRICS_PERSIST = 'false';
    try {
      const a = await boot();
      const p = a.get(PrismaService);
      const count = async () => Number((await p.$queryRaw<{ v: bigint | null }[]>`SELECT SUM("value")::bigint AS v FROM "FinanceMetricCounter" WHERE "name" = 'ledger_adjustments'`)[0]?.v ?? 0);
      const b = await count();
      financeMetrics.inc('ledger_adjustments', 3);
      await a.close();
      const a2 = await boot();
      const after = Number((await a2.get(PrismaService).$queryRaw<{ v: bigint | null }[]>`SELECT SUM("value")::bigint AS v FROM "FinanceMetricCounter" WHERE "name" = 'ledger_adjustments'`)[0]?.v ?? 0);
      await a2.close();
      assert.equal(after, b);
    } finally {
      delete process.env.FINANCE_METRICS_PERSIST;
      financeMetrics.reset();
    }
  });

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\nfinance-metrics.db.spec: ${results.length - failed} PASS / ${failed} FAIL`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('finance-metrics.db.spec FATAL', e);
  process.exit(1);
});
