import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ShippingController } from './shipping.controller';
import { ShippingService } from './shipping.service';

@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [ShippingController],
  providers: [
    ShippingService,
    { provide: 'ShippingProvider', useExisting: ShippingService },
  ],
  exports: [ShippingService, 'ShippingProvider'],
})
export class ShippingModule {}
