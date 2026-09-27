import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { structuredLog } from '../../common/structured-log';
import { FINANCE_COUNTERS, financeMetrics, saoPauloDay, type PendingDelta } from './finance-metrics';

const DEFAULT_FLUSH_MS = 5_000;
const SHUTDOWN_FLUSH_TIMEOUT_MS = 2_000;

export function metricsPersistEnabled(env: NodeJS.ProcessEnv = process.env) {
  return String(env.FINANCE_METRICS_PERSIST ?? 'true').toLowerCase() !== 'false';
}

function flushIntervalMs(env: NodeJS.ProcessEnv = process.env) {
  const n = Number(env.FINANCE_METRICS_FLUSH_MS);
  return Number.isFinite(n) && n >= 250 ? Math.floor(n) : DEFAULT_FLUSH_MS;
}

type Totals = Record<string, number>;
const emptyTotals = (): Totals => Object.fromEntries(FINANCE_COUNTERS.map((k) => [k, 0]));

/**
 * Persists financeMetrics increments in Postgres (FinanceMetricCounter, daily buckets).
 *  - periodic flush (FINANCE_METRICS_FLUSH_MS, default 5 s) + flush on module destroy and on SIGTERM
 *    (Railway redeploy), bounded by 2 s; a hard kill loses at most one interval of counters;
 *  - one multi-row `INSERT … ON CONFLICT DO UPDATE SET value = value + EXCLUDED.value` per flush
 *    (atomic across replicas; concurrent flushes never lose increments);
 *  - a failed flush (DB down, table missing before the migration) re-queues the deltas; the
 *    financial flow is never blocked. Kill switch: FINANCE_METRICS_PERSIST=false.
 */
@Injectable()
export class FinanceMetricsStore implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(FinanceMetricsStore.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private flushing: Promise<number> | null = null;
  private lastErrorLogAt = 0;
  private onSigterm: (() => void) | null = null;
  readonly stats = { flushes: 0, rowsUpserted: 0, failures: 0, lastFlushAt: null as string | null, lastError: null as string | null };

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (!metricsPersistEnabled()) {
      this.log.log('Métricas financeiras persistentes DESATIVADAS (FINANCE_METRICS_PERSIST=false)');
      return;
    }
    const ms = flushIntervalMs();
    this.timer = setInterval(() => void this.flush(), ms);
    this.timer.unref?.();
    // Flush once on SIGTERM, then re-raise it so Node's default exit behaviour is preserved.
    const handler = () => {
      const done = () => process.kill(process.pid, 'SIGTERM');
      Promise.race([this.flush(), new Promise((r) => setTimeout(r, SHUTDOWN_FLUSH_TIMEOUT_MS).unref?.())]).then(done, done);
    };
    this.onSigterm = handler;
    process.once('SIGTERM', handler);
    this.log.log(`Métricas financeiras persistentes: flush a cada ${ms / 1000}s (FinanceMetricCounter)`);
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.onSigterm) process.removeListener('SIGTERM', this.onSigterm);
    this.onSigterm = null;
    if (metricsPersistEnabled()) await this.flush();
  }

  /** Persist all queued deltas. Returns the number of (day, counter) rows upserted. Never throws. */
  flush(): Promise<number> {
    if (this.flushing) return this.flushing.then(() => this.flush());
    const run = this.doFlush().finally(() => {
      this.flushing = null;
    });
    this.flushing = run;
    return run;
  }

  private async doFlush(): Promise<number> {
    const deltas = financeMetrics.drainPending().filter((d) => d.delta !== 0);
    if (!deltas.length) return 0;
    try {
      await this.upsert(deltas);
      this.stats.flushes++;
      this.stats.rowsUpserted += deltas.length;
      this.stats.lastFlushAt = new Date().toISOString();
      this.stats.lastError = null;
      return deltas.length;
    } catch (e: any) {
      financeMetrics.requeue(deltas);
      this.stats.failures++;
      this.stats.lastError = String(e?.message || e).slice(0, 200);
      if (Date.now() - this.lastErrorLogAt > 60_000) {
        this.lastErrorLogAt = Date.now();
        structuredLog('warn', 'FINANCE_METRICS_FLUSH_FAILED', { pendingRows: deltas.length, error: this.stats.lastError });
      }
      return 0;
    }
  }

  private async upsert(deltas: PendingDelta[]) {
    const rows = deltas.map((d) => Prisma.sql`(${d.day}::date, ${d.name}, ${BigInt(Math.trunc(d.delta))}, CURRENT_TIMESTAMP)`);
    await this.prisma.$executeRaw`
      INSERT INTO "FinanceMetricCounter" ("day", "name", "value", "updatedAt")
      VALUES ${Prisma.join(rows)}
      ON CONFLICT ("day", "name") DO UPDATE
        SET "value" = "FinanceMetricCounter"."value" + EXCLUDED."value",
            "updatedAt" = CURRENT_TIMESTAMP`;
  }

  /**
   * Durable view: today (America/Sao_Paulo), last 7 days (incl. today) and all time, plus this
   * replica's not-yet-flushed deltas (read-your-writes). Other replicas' unflushed deltas (≤ one
   * flush interval) are not visible until they flush.
   */
  async persisted(now = new Date()) {
    const today = saoPauloDay(now);
    const weekStart = saoPauloDay(new Date(now.getTime() - 6 * 86_400_000));
    const out = { today: emptyTotals(), last7Days: emptyTotals(), allTime: emptyTotals() };
    let firstDay: string | null = null;
    let available = true;
    let error: string | null = null;
    try {
      const rows = await this.prisma.$queryRaw<{ day: string; name: string; value: bigint }[]>`
        SELECT to_char("day", 'YYYY-MM-DD') AS "day", "name", "value" FROM "FinanceMetricCounter"
        WHERE "day" >= ${weekStart}::date
        UNION ALL
        SELECT 'all' AS "day", "name", SUM("value")::bigint AS "value" FROM "FinanceMetricCounter" GROUP BY "name"`;
      const first = await this.prisma.$queryRaw<{ d: string | null }[]>`SELECT to_char(MIN("day"), 'YYYY-MM-DD') AS "d" FROM "FinanceMetricCounter"`;
      firstDay = first[0]?.d ?? null;
      for (const r of rows) {
        if (!(r.name in out.allTime)) continue;
        const v = Number(r.value);
        if (r.day === 'all') out.allTime[r.name] += v;
        else {
          out.last7Days[r.name] += v;
          if (r.day === today) out.today[r.name] += v;
        }
      }
    } catch (e: any) {
      available = false;
      error = String(e?.message || e).slice(0, 200);
    }
    const unflushed = financeMetrics.peekPending();
    for (const d of unflushed) {
      if (!(d.name in out.allTime)) continue;
      out.allTime[d.name] += d.delta;
      if (d.day >= weekStart) out.last7Days[d.name] += d.delta;
      if (d.day === today) out.today[d.name] += d.delta;
    }
    return {
      scope: 'database' as const,
      enabled: metricsPersistEnabled(),
      available,
      error,
      timezone: 'America/Sao_Paulo',
      today: { day: today, counters: out.today },
      last7Days: { from: weekStart, to: today, counters: out.last7Days },
      allTime: { since: firstDay, counters: out.allTime },
      unflushedThisReplica: unflushed.reduce((s, d) => s + d.delta, 0),
      flush: { ...this.stats, intervalMs: flushIntervalMs() },
    };
  }
}
