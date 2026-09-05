import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AddressesController } from './addresses.controller';
import { AddressesService } from './addresses.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AddressesController],
  providers: [AddressesService],
  exports: [AddressesService],
})
export class AddressesModule {}
