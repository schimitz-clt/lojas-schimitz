import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { OptionalJwtGuard } from '../../common/guards/optional-jwt.guard';
import { ShippingController } from './shipping.controller';
import { ShippingService } from './shipping.service';
import { createCarrierProviderFromEnv } from './carriers';

@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [ShippingController],
  providers: [
    OptionalJwtGuard,
    ShippingService,
    { provide: 'ShippingProvider', useExisting: ShippingService },
    { provide: 'CarrierProvider', useFactory: () => createCarrierProviderFromEnv() },
  ],
  exports: [ShippingService, 'ShippingProvider', 'CarrierProvider'],
})
export class ShippingModule {}
