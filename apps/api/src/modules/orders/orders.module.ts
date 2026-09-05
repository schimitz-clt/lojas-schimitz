import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { ReservationsExpiryService } from './reservations-expiry.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [OrdersController],
  providers: [OrdersService, ReservationsExpiryService],
  exports: [OrdersService],
})
export class OrdersModule {}
