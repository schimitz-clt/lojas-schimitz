import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ok } from '../../common/http';
import { ShippingService } from './shipping.service';

class QuoteShippingDto {
  @IsString()
  cep!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  subtotal!: number;

  @IsOptional()
  items?: { qty: number; weightKg?: number }[];
}

@Controller('shipping')
@UseGuards(JwtAuthGuard)
export class ShippingController {
  constructor(private readonly shipping: ShippingService) {}

  /** Cotação de frete própria para o checkout (antes de confirmar o pedido). */
  @Post('quote')
  async quote(@Body() dto: QuoteShippingDto) {
    const data = await this.shipping.quoteDetailed({
      cep: dto.cep,
      subtotal: dto.subtotal,
      items: dto.items ?? [],
    });
    return ok(data);
  }
}
