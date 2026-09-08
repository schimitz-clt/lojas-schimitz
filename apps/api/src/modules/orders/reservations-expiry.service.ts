import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma.service';
import { OrdersService } from './orders.service';
import { releaseSchedulerLock, tryAcquireSchedulerLock } from './scheduler-lock';

const INTERVAL_MS = 60_000;
const LOCK_ID = 'expireReservations';
const LOCK_TTL_MS = 50_000;

/**
 * MULTI_REPLICA: setInterval roda em CADA réplica do processo Node.
 * Correção de corrida de pedido já é DB-safe (UPDATE condicional de status awaiting_payment).
 * Este serviço usa lease em `SchedulerLock` para que só uma réplica execute o
 * ciclo (evita cancelIntent duplicado / log spam). Se o lease falhar (DB down),
 * o tick é pulado — o próximo ciclo tenta de novo.
 */
@Injectable()
export class ReservationsExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(ReservationsExpiryService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private readonly holder = `pid-${process.pid}-${randomUUID().slice(0, 8)}`;

  constructor(
    @Inject(OrdersService) private readonly orders: OrdersService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.tick();
    }, INTERVAL_MS);
    this.log.log(
      `Reservas: job a cada ${INTERVAL_MS / 1000}s (lease DB + expireReservations; MULTI_REPLICA-safe)`,
    );
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    void releaseSchedulerLock(this.prisma, LOCK_ID, this.holder).catch(() => undefined);
  }

  async tick() {
    if (this.running) return { skipped: true, expired: 0, reason: 'in_process' };
    this.running = true;
    let acquired = false;
    try {
      acquired = await tryAcquireSchedulerLock(this.prisma, LOCK_ID, this.holder, LOCK_TTL_MS);
      if (!acquired) {
        return { skipped: true, expired: 0, reason: 'scheduler_lock' };
      }
      const result = await this.orders.expireReservations();
      if (result.expired > 0) {
        this.log.log(`Reservas expiradas neste ciclo: ${result.expired}`);
      }
      return { skipped: false, ...result };
    } catch (e) {
      this.log.error('Falha ao expirar reservas', e instanceof Error ? e.stack : String(e));
      return { skipped: false, expired: 0, error: true };
    } finally {
      if (acquired) {
        await releaseSchedulerLock(this.prisma, LOCK_ID, this.holder).catch(() => undefined);
      }
      this.running = false;
    }
  }
}
