import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SellersService } from './sellers.service';
import { SellerPortalService } from './seller-portal.service';
import { SellerPortalController } from './seller-portal.controller';
import { SellersPublicController } from './sellers.controller';
import { CommissionsModule } from '../commissions/commissions.module';
import { MpOAuthService } from '../marketplace-mp/mp-oauth.service';
import { MpOAuthRefreshService } from '../marketplace-mp/mp-oauth-refresh.service';

@Module({
  imports: [JwtModule.register({}), CommissionsModule],
  controllers: [SellerPortalController, SellersPublicController],
  providers: [SellersService, SellerPortalService, MpOAuthService, MpOAuthRefreshService],
  exports: [SellersService, SellerPortalService, MpOAuthService],
})
export class SellersModule {}
