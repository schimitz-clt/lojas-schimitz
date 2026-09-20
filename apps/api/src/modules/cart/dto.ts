import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';

export class AddCartItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ minimum: 1, example: 1 })
  @IsInt()
  @Min(1)
  qty!: number;
}

export class UpdateCartItemDto {
  @ApiProperty({ minimum: 1, example: 2 })
  @IsInt()
  @Min(1)
  qty!: number;
}

export class ApplyCartCouponDto {
  @ApiProperty({ example: 'SCHIMITZ10' })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  code!: string;
}
