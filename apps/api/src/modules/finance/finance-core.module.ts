import { Global, Module } from '@nestjs/common';
import { FinancialRecorder } from './financial-recorder.service';
import { ChargebacksService } from './chargebacks.service';
import { RiskService } from './risk.service';
import { FinanceMetricsStore } from './finance-metrics.store';

/**
 * Global financial core (depends only on Prisma + PaymentProvider, both global) so Orders and
 * Payments can record transitions/ledger without module cycles.
 */
@Global()
@Module({
  providers: [FinancialRecorder, ChargebacksService, RiskService, FinanceMetricsStore],
  exports: [FinancialRecorder, ChargebacksService, RiskService, FinanceMetricsStore],
})
export class FinanceCoreModule {}
