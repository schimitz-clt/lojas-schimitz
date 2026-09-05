import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateOrderDto {
  @IsUUID()
  addressId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  couponCode?: string;
}

/** Admin: avanço manual de fulfillment (sem carrier). */
export class AdminUpdateOrderStatusDto {
  @IsString()
  @IsIn(['separating', 'shipped', 'delivered'])
  status!: 'separating' | 'shipped' | 'delivered';
}
