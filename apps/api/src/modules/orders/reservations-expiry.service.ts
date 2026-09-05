import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OrdersService } from './orders.service';

const INTERVAL_MS = 60_000;

@Injectable()
export class ReservationsExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(ReservationsExpiryService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(private readonly orders: OrdersService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.tick();
    }, INTERVAL_MS);
    this.log.log(`Reservas: job a cada ${INTERVAL_MS / 1000}s (delega a expireReservations)`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick() {
    if (this.running) return { skipped: true, expired: 0 };
    this.running = true;
    try {
      const result = await this.orders.expireReservations();
      if (result.expired > 0) {
        this.log.log(`Reservas expiradas neste ciclo: ${result.expired}`);
      }
      return { skipped: false, ...result };
    } catch (e) {
      this.log.error('Falha ao expirar reservas', e instanceof Error ? e.stack : String(e));
      return { skipped: false, expired: 0, error: true };
    } finally {
      this.running = false;
    }
  }
}
