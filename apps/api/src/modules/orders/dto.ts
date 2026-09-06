import { IsIn, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderDto {
  @IsUUID()
  addressId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  couponCode?: string;

  /** Valor de SCHIMITZ+ (cashback) a resgatar neste pedido (parcial OK). */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  cashbackAmount?: number;
}

/** Admin: avanço manual de fulfillment (entrega própria). */
export class AdminUpdateOrderStatusDto {
  @IsString()
  @IsIn(['organizing', 'packing', 'ready_for_pickup', 'in_transit', 'delivered', 'separating', 'shipped'])
  status!: 'organizing' | 'packing' | 'ready_for_pickup' | 'in_transit' | 'delivered' | 'separating' | 'shipped';

  /** Código de rastreio — recomendado ao marcar in_transit/shipped. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  trackingCode?: string | null;

  /** Transportadora / etiqueta (ex.: propria, correios). */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  carrier?: string | null;
}
