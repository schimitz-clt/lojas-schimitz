import { IsIn, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ADMIN_FULFILLMENT_TARGETS, type AdminFulfillmentTargetStatus } from '../../common/order-status';

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

  /** Atribuição opcional. Valores inválidos viram null e não impedem o pedido. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  utmSource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  utmMedium?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  utmCampaign?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  utmContent?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  utmTerm?: string;
}

/** Admin: avanço manual de fulfillment (entrega própria). */
export class AdminUpdateOrderStatusDto {
  @IsString()
  @IsIn([...ADMIN_FULFILLMENT_TARGETS])
  status!: AdminFulfillmentTargetStatus;

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
