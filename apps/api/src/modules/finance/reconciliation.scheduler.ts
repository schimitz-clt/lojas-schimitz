import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { ReconciliationService } from './reconciliation.service';

const CHECK_EVERY_MS = 60 * 60_000;
const DAILY_MS = 23 * 60 * 60_000;

export function reconciliationCronEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return String(env.FINANCE_RECONCILIATION_CRON_ENABLED || '').toLowerCase() === 'true';
}

/**
 * Daily reconciliation. OFF by default (FINANCE_RECONCILIATION_CRON_ENABLED=true to enable).
 * Checks hourly whether a DAILY run completed in the last 23h; the run itself takes the
 * global DB lease (finrecon:global), so multiple replicas never run concurrently.
 * Read-only by default (no auto-repair unless FINANCE_RECONCILIATION_AUTO_REPAIR=true).
 */
@Injectable()
export class ReconciliationScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(ReconciliationScheduler.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    @Inject(ReconciliationService) private readonly recon: ReconciliationService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    if (!reconciliationCronEnabled()) {
      this.log.log('Reconciliação diária desativada (FINANCE_RECONCILIATION_CRON_ENABLED != true)');
      return;
    }
    this.timer = setInterval(() => void this.tick(), CHECK_EVERY_MS);
    setTimeout(() => void this.tick(), 5 * 60_000).unref?.();
    this.log.log('Reconciliação diária ativa (verificação horária, lease DB finrecon:global)');
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick() {
    if (this.running) return { skipped: 'in_process' };
    this.running = true;
    try {
      const last = await this.prisma.financialReconciliationRun.findFirst({
        where: { scope: 'DAILY', status: 'COMPLETED' },
        orderBy: { startedAt: 'desc' },
      });
      if (last && Date.now() - last.startedAt.getTime() < DAILY_MS) return { skipped: 'recent' };
      return await this.recon.run({
        scope: 'DAILY',
        origin: 'cron',
        autoRepair: String(process.env.FINANCE_RECONCILIATION_AUTO_REPAIR || '').toLowerCase() === 'true',
      });
    } catch (e) {
      this.log.error('Falha na reconciliação diária', e instanceof Error ? e.stack : String(e));
      return { error: true };
    } finally {
      this.running = false;
    }
  }
}
