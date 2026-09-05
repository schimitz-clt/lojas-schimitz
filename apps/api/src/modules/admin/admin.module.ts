import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminController } from './admin.controller';
import { AdminProductsService } from './admin-products.service';
import { AdminSalesReportService } from './admin-sales-report.service';
import { OrdersModule } from '../orders/orders.module';
import { UploadsModule } from '../uploads/uploads.module';
import { CouponsModule } from '../coupons/coupons.module';
import { ShippingModule } from '../shipping/shipping.module';
import { ReviewsModule } from '../reviews/reviews.module';

@Module({
  imports: [JwtModule.register({}), OrdersModule, UploadsModule, CouponsModule, ShippingModule, ReviewsModule],
  controllers: [AdminController],
  providers: [AdminProductsService, AdminSalesReportService],
})
export class AdminModule {}
