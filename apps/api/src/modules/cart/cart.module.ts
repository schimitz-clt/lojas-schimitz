import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { OptionalJwtGuard } from '../../common/guards/optional-jwt.guard';
import { CouponsModule } from '../coupons/coupons.module';

@Module({
  imports: [JwtModule.register({}), CouponsModule],
  controllers: [CartController],
  providers: [CartService, OptionalJwtGuard],
  exports: [CartService],
})
export class CartModule {}
