import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SellersService } from './sellers.service';
import { SellerPortalService } from './seller-portal.service';
import { SellerPortalController } from './seller-portal.controller';

@Module({
  imports: [JwtModule.register({})],
  controllers: [SellerPortalController],
  providers: [SellersService, SellerPortalService],
  exports: [SellersService, SellerPortalService],
})
export class SellersModule {}
