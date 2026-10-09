import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma.service';
import { releaseSchedulerLock, tryAcquireSchedulerLock } from '../orders/scheduler-lock';
import { PushCampaignsService } from './push-campaigns.service';
import { AbandonedViewService } from './abandoned-view.service';
import { productViewRetentionDue, purgeExpiredProductViews } from './product-view-retention';

const INTERVAL_MS = 30_000;
const LOCK_ID = 'pushCampaignDispatch';
const LOCK_TTL_MS = 25_000;

/**
 * Scheduled promotional FCM. Reuses SchedulerLock (same pattern as expireReservations).
 * MULTI_REPLICA-safe. Missing Firebase credentials → campaign marked NÃO EXECUTADO (failed/skipped), never fake sent.
 */
@Injectable()
export class PushSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(PushSchedulerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private lastRetentionAt: number | null = null;
  private readonly holder = `pid-${process.pid}-${randomUUID().slice(0, 8)}`;

  constructor(
    @Inject(PushCampaignsService) private readonly campaigns: PushCampaignsService,
    @Inject(AbandonedViewService) private readonly abandoned: AbandonedViewService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.tick();
    }, INTERVAL_MS);
    this.log.log(
      `Push FCM: job a cada ${INTERVAL_MS / 1000}s (campanhas agendadas + recuperação de produto; MULTI_REPLICA-safe)`,
    );
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    void releaseSchedulerLock(this.prisma, LOCK_ID, this.holder).catch(() => undefined);
  }

  /** LGPD: produtos vistos > 90 dias. Falha aqui nunca derruba o job de push. */
  private async runRetentionIfDue() {
    const now = Date.now();
    if (!productViewRetentionDue(this.lastRetentionAt, now)) return null;
    this.lastRetentionAt = now;
    try {
      const r = await purgeExpiredProductViews(this.prisma, new Date(now));
      if (r.views || r.pushes) {
        this.log.log(`Retenção produtos vistos: views=${r.views} pushes=${r.pushes} (antes de ${r.cutoff})`);
      }
      return r;
    } catch (e) {
      this.log.error('Falha na limpeza de produtos vistos', e instanceof Error ? e.stack : String(e));
      return null;
    }
  }

  async tick() {
    if (this.running) return { skipped: true, processed: 0, reason: 'in_process' };
    this.running = true;
    let acquired = false;
    try {
      acquired = await tryAcquireSchedulerLock(this.prisma, LOCK_ID, this.holder, LOCK_TTL_MS);
      if (!acquired) {
        return { skipped: true, processed: 0, reason: 'scheduler_lock' };
      }
      const result = await this.campaigns.dispatchDue();
      if (result.processed > 0) {
        this.log.log(`Push agendado: processed=${result.processed}`);
      }
      const abandoned = await this.abandoned.processDue();
      const retention = await this.runRetentionIfDue();
      return { skipped: false, ...result, abandoned, retention };
    } catch (e) {
      this.log.error('Falha no job de push agendado', e instanceof Error ? e.stack : String(e));
      return { skipped: false, processed: 0, error: true };
    } finally {
      if (acquired) {
        await releaseSchedulerLock(this.prisma, LOCK_ID, this.holder).catch(() => undefined);
      }
      this.running = false;
    }
  }
}
