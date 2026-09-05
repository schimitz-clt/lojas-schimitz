import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminController } from './admin.controller';
import { AdminProductsService } from './admin-products.service';
import { OrdersModule } from '../orders/orders.module';
import { UploadsModule } from '../uploads/uploads.module';
import { CouponsModule } from '../coupons/coupons.module';
import { ShippingModule } from '../shipping/shipping.module';

@Module({
  imports: [JwtModule.register({}), OrdersModule, UploadsModule, CouponsModule, ShippingModule],
  controllers: [AdminController],
  providers: [AdminProductsService],
})
export class AdminModule {}
