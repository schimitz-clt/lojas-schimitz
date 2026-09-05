import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ok } from '../../common/http';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CouponsService } from './coupons.service';
import { IsNumber, IsString, Min } from 'class-validator';

class ValidateCouponDto {
  @IsString()
  code!: string;

  @IsNumber()
  @Min(0)
  subtotal!: number;
}

@Controller('coupons')
@UseGuards(JwtAuthGuard)
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Post('validate')
  async validate(@Body() dto: ValidateCouponDto) {
    return ok(await this.coupons.validate(dto.code, dto.subtotal));
  }
}
