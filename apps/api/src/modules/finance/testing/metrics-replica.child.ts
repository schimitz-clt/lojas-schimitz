/**
 * Child process = one API replica for finance-metrics.db.spec.ts (real Nest DI, real Prisma, real store).
 * argv: <mode> <counter> <n>
 *   burst   : n increments with a flush every 25 increments (concurrent replicas hammering the same row)
 *   sigterm : n increments, NO flush, print READY and wait for SIGTERM (Railway redeploy)
 */
import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PrismaService } from '../../../prisma.service';
import { FinanceMetricsStore } from '../finance-metrics.store';
import { financeMetrics, type FinanceCounter } from '../finance-metrics';

@Module({ providers: [PrismaService, FinanceMetricsStore] })
class ReplicaModule {}

async function main() {
  const [mode, counter, nRaw] = process.argv.slice(2);
  const n = Number(nRaw);
  const app = await NestFactory.createApplicationContext(ReplicaModule, { logger: false });
  const store = app.get(FinanceMetricsStore);
  if (mode === 'burst') {
    const flushes: Promise<number>[] = [];
    for (let i = 1; i <= n; i++) {
      financeMetrics.inc(counter as FinanceCounter);
      if (i % 25 === 0) flushes.push(store.flush());
      if (i % 10 === 0) await new Promise((r) => setImmediate(r));
    }
    await Promise.all(flushes);
    await app.close(); // final flush on destroy
    process.stdout.write(`DONE ${JSON.stringify(store.stats)}\n`);
    process.exit(0);
  }
  if (mode === 'sigterm') {
    for (let i = 0; i < n; i++) financeMetrics.inc(counter as FinanceCounter);
    process.stdout.write('READY\n');
    setInterval(() => undefined, 1000); // stay alive like a server
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
