import { Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnApplicationShutdown {
  async onModuleInit() {
    await this.$connect();
  }

  /**
   * Disconnect only after every module's onModuleDestroy has finished.
   * Nest runs onModuleDestroy hooks concurrently, so disconnecting there raced with
   * FinanceMetricsStore's final flush on app.close() ("Engine is not yet connected"),
   * losing the last queued deltas (flaky finance-metrics M04 on CI).
   */
  async onApplicationShutdown() {
    await this.$disconnect();
  }
}
