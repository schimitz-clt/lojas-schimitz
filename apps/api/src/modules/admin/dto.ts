import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

/** Converte string/número; preserva null/undefined (limpar preço “de”). */
function optionalMoney({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === '') return value === '' ? null : value;
  return typeof value === 'number' ? value : Number(value);
}

export class AdminCreateProductDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @IsOptional()
  @Transform(optionalMoney)
  @ValidateIf((_, v) => v != null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  compareAtPrice?: number | null;

  /** SKU único. Se omitido, a API gera um. */
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  sku?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  /** URL pública da imagem (upload local /uploads ou URL externa). */
  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsUrl({ require_protocol: true })
  @MaxLength(2000)
  imageUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  badge?: string | null;
}

export class AdminUpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;

  @IsOptional()
  @Transform(optionalMoney)
  @ValidateIf((_, v) => v != null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  compareAtPrice?: number | null;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  sku?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsUrl({ require_protocol: true })
  @MaxLength(2000)
  imageUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  badge?: string | null;
}
