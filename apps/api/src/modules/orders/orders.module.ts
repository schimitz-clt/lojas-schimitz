import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { ReservationsExpiryService } from './reservations-expiry.service';
import { CouponsModule } from '../coupons/coupons.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [JwtModule.register({}), CouponsModule, LoyaltyModule, NotificationsModule],
  controllers: [OrdersController],
  providers: [OrdersService, ReservationsExpiryService],
  exports: [OrdersService],
})
export class OrdersModule {}
