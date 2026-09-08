import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ok } from '../../common/http';
import { ShippingService } from './shipping.service';

class QuoteShippingDto {
  @ApiProperty({ example: '91160-390' })
  @IsString()
  cep!: string;

  @ApiProperty({ example: 199.9, minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  subtotal!: number;

  @ApiPropertyOptional({ description: 'Itens opcionais (peso futuro)' })
  @IsOptional()
  items?: { qty: number; weightKg?: number }[];
}

@ApiTags('shipping')
@ApiBearerAuth('access-token')
@Controller('shipping')
@UseGuards(JwtAuthGuard)
export class ShippingController {
  constructor(private readonly shipping: ShippingService) {}

  /** Cotação de frete própria para o checkout (antes de confirmar o pedido). */
  @Post('quote')
  @ApiOperation({ summary: 'Cotar frete por CEP + subtotal' })
  async quote(@Body() dto: QuoteShippingDto) {
    const data = await this.shipping.quoteDetailed({
      cep: dto.cep,
      subtotal: dto.subtotal,
      items: dto.items ?? [],
    });
    return ok(data);
  }
}
