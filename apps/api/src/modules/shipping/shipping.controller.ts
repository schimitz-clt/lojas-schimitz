import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { OptionalJwtGuard } from '../../common/guards/optional-jwt.guard';
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
@Controller('shipping')
@UseGuards(OptionalJwtGuard)
export class ShippingController {
  constructor(private readonly shipping: ShippingService) {}

  /** Cotação da entrega própria (PDP + checkout). Sem transportadora externa. */
  @Post('quote')
  @ApiOperation({ summary: 'Cotar frete por CEP + subtotal (público / opcionalmente autenticado)' })
  async quote(@Body() dto: QuoteShippingDto) {
    const data = await this.shipping.quoteDetailed({
      cep: dto.cep,
      subtotal: dto.subtotal,
      items: dto.items ?? [],
    });
    return ok(data);
  }
}
