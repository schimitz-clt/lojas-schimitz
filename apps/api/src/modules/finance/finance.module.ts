import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PaymentsModule } from '../payments/payments.module';
import { OrdersModule } from '../orders/orders.module';
import { RefundsService } from './refunds.service';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationScheduler } from './reconciliation.scheduler';
import { FinanceAdminService } from './finance-admin.service';
import { FinanceAdminController } from './finance-admin.controller';

@Module({
  imports: [JwtModule.register({}), PaymentsModule, OrdersModule],
  controllers: [FinanceAdminController],
  providers: [RefundsService, ReconciliationService, ReconciliationScheduler, FinanceAdminService],
  exports: [RefundsService, ReconciliationService],
})
export class FinanceModule {}
