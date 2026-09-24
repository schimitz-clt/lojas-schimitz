import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { OptionalJwtGuard } from '../../common/guards/optional-jwt.guard';
import { ok } from '../../common/http';
import { ShippingService } from './shipping.service';

class QuoteItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: 1, minimum: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  qty!: number;

  @ApiPropertyOptional({ description: 'Peso de uma unidade, em kg' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weightKg?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  widthCm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  heightCm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  lengthCm?: number;

  @ApiPropertyOptional({ description: 'Valor segurado de uma unidade' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  insuranceValue?: number;
}

class QuoteShippingDto {
  @ApiProperty({ example: '91160-390' })
  @IsString()
  cep!: string;

  @ApiProperty({ example: 199.9, minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  subtotal!: number;

  @ApiPropertyOptional({ description: 'Itens com peso e medidas reais, quando o catálogo tiver' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  items?: QuoteItemDto[];
}

@ApiTags('shipping')
@Controller('shipping')
@UseGuards(OptionalJwtGuard)
export class ShippingController {
  constructor(private readonly shipping: ShippingService) {}

  /** Cotação por CEP (Melhor Envio). Zona grátis zera o preço; o prazo é o calculado. */
  @Post('quote')
  @ApiOperation({ summary: 'Cotar frete por CEP (cálculo Melhor Envio; Porto Alegre grátis com prazo calculado)' })
  async quote(@Body() dto: QuoteShippingDto) {
    const data = await this.shipping.quoteDetailed({
      cep: dto.cep,
      subtotal: dto.subtotal,
      items: dto.items ?? [],
    });
    return ok(data);
  }
}
