import { Global, Module } from '@nestjs/common';
import { FinancialRecorder } from './financial-recorder.service';
import { ChargebacksService } from './chargebacks.service';
import { RiskService } from './risk.service';

/**
 * Global financial core (depends only on Prisma + PaymentProvider, both global) so Orders and
 * Payments can record transitions/ledger without module cycles.
 */
@Global()
@Module({
  providers: [FinancialRecorder, ChargebacksService, RiskService],
  exports: [FinancialRecorder, ChargebacksService, RiskService],
})
export class FinanceCoreModule {}
