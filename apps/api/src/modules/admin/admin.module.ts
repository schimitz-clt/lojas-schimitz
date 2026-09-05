import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminController } from './admin.controller';
import { AdminProductsService } from './admin-products.service';
import { OrdersModule } from '../orders/orders.module';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [JwtModule.register({}), OrdersModule, UploadsModule],
  controllers: [AdminController],
  providers: [AdminProductsService],
})
export class AdminModule {}
