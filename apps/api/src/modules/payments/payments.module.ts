import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { OrdersModule } from '../orders/orders.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { CommissionsModule } from '../commissions/commissions.module';
import { PaymentsController, WebhooksController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { AdminPaymentsController } from './admin-payments.controller';

@Module({
  imports: [JwtModule.register({}), OrdersModule, LoyaltyModule, CommissionsModule],
  controllers: [PaymentsController, WebhooksController, AdminPaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
