import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class AddCartItemDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  qty!: number;
}

export class UpdateCartItemDto {
  @IsInt()
  @Min(1)
  qty!: number;
}
