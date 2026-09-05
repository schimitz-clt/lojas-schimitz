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

/** Admin: avanço manual de fulfillment (sem carrier). */
export class AdminUpdateOrderStatusDto {
  @IsString()
  @IsIn(['separating', 'shipped', 'delivered'])
  status!: 'separating' | 'shipped' | 'delivered';
}
