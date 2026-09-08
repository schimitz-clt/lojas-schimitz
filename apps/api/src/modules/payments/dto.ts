import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreatePaymentIntentDto {
  @IsUUID()
  orderId!: string;

  @IsString()
  @IsIn(['pix', 'card'])
  method!: 'pix' | 'card';

  /** Token do Checkout Bricks (somente card). */
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(512)
  cardToken?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  installments?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  paymentMethodId?: string;
}
