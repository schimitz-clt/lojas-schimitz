import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminController } from './admin.controller';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [JwtModule.register({}), OrdersModule],
  controllers: [AdminController],
})
export class AdminModule {}
