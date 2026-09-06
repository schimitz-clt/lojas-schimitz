import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminController } from './admin.controller';
import { AdminProductsService } from './admin-products.service';
import { AdminSalesReportService } from './admin-sales-report.service';
import { AdminUsersService } from './admin-users.service';
import { OrdersModule } from '../orders/orders.module';
import { UploadsModule } from '../uploads/uploads.module';
import { CouponsModule } from '../coupons/coupons.module';
import { ShippingModule } from '../shipping/shipping.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { StorefrontModule } from '../storefront/storefront.module';
import { SellersModule } from '../sellers/sellers.module';

@Module({
  imports: [
    JwtModule.register({}),
    OrdersModule,
    UploadsModule,
    CouponsModule,
    ShippingModule,
    ReviewsModule,
    StorefrontModule,
    SellersModule,
  ],
  controllers: [AdminController],
  providers: [AdminProductsService, AdminSalesReportService, AdminUsersService],
})
export class AdminModule {}
