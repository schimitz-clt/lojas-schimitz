import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma.service';
import { releaseSchedulerLock, tryAcquireSchedulerLock } from '../orders/scheduler-lock';
import { isMarketplaceSplitEnabled } from './marketplace-mp.flags';
import { MpOAuthService } from './mp-oauth.service';

const INTERVAL_MS = 60 * 60 * 1000;
const LOCK_ID = 'mpOAuthRefresh';
const LOCK_TTL_MS = 5 * 60 * 1000;

/**
 * Phase 1 scaffolding: refresh seller MP tokens before expiry.
 * No-op when MP_MARKETPLACE_SPLIT_ENABLED is off. Never charges.
 */
@Injectable()
export class MpOAuthRefreshService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(MpOAuthRefreshService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private readonly holder = `pid-${process.pid}-${randomUUID().slice(0, 8)}`;

  constructor(
    @Inject(MpOAuthService) private readonly oauth: MpOAuthService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.tick();
    }, INTERVAL_MS);
    this.log.log(
      `MP OAuth refresh: job a cada ${INTERVAL_MS / 1000}s (lease DB; no-op se flag off)`,
    );
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    void releaseSchedulerLock(this.prisma, LOCK_ID, this.holder).catch(() => undefined);
  }

  async tick() {
    if (this.running) return { skipped: true, refreshed: 0, failed: 0, reason: 'in_process' };
    if (!isMarketplaceSplitEnabled()) {
      return { skipped: true, refreshed: 0, failed: 0, reason: 'flag_off' };
    }
    this.running = true;
    let acquired = false;
    try {
      acquired = await tryAcquireSchedulerLock(this.prisma, LOCK_ID, this.holder, LOCK_TTL_MS);
      if (!acquired) {
        return { skipped: true, refreshed: 0, failed: 0, reason: 'scheduler_lock' };
      }
      const result = await this.oauth.refreshDue();
      if (!result.skipped && (result.refreshed > 0 || result.failed > 0)) {
        this.log.log(`MP OAuth refresh: refreshed=${result.refreshed} failed=${result.failed}`);
      }
      return result;
    } catch (e) {
      this.log.error('Falha no refresh OAuth MP', e instanceof Error ? e.stack : String(e));
      return { skipped: false, refreshed: 0, failed: 0, error: true };
    } finally {
      if (acquired) {
        await releaseSchedulerLock(this.prisma, LOCK_ID, this.holder).catch(() => undefined);
      }
      this.running = false;
    }
  }
}
