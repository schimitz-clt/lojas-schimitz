import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
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

/** Query GET /admin/orders?status= */
export class AdminOrdersQueryDto {
  @IsOptional()
  @IsString()
  @IsIn([
    'draft',
    'awaiting_payment',
    'paid',
    'separating',
    'shipped',
    'delivered',
    'cancelled',
    'refunded',
  ])
  status?: string;
}

/** Query GET /admin/products?lowStock=5 */
export class AdminProductsQueryDto {
  /** Se informado, retorna só produtos com qtyOnHand <= este valor. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lowStock?: number;
}

/** Admin: criar cupom */
export class AdminCreateCouponDto {
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  code!: string;

  @IsString()
  @IsIn(['percent', 'fixed'])
  type!: 'percent' | 'fixed';

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  value!: number;

  @IsOptional()
  @Transform(optionalMoney)
  @ValidateIf((_, v) => v != null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minSubtotal?: number | null;

  @IsOptional()
  @IsString()
  startsAt?: string | null;

  @IsOptional()
  @IsString()
  endsAt?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxUses?: number | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class AdminUpdateCouponDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  code?: string;

  @IsOptional()
  @IsString()
  @IsIn(['percent', 'fixed'])
  type?: 'percent' | 'fixed';

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  value?: number;

  @IsOptional()
  @Transform(optionalMoney)
  @ValidateIf((_, v) => v != null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minSubtotal?: number | null;

  @IsOptional()
  @IsString()
  startsAt?: string | null;

  @IsOptional()
  @IsString()
  endsAt?: string | null;

  @IsOptional()
  @Type(() => Number)
  @ValidateIf((_, v) => v != null)
  @IsInt()
  @Min(1)
  maxUses?: number | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

/** Admin: configuração global de frete própria */
export class AdminUpdateShippingSettingsDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  freeAbove!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  defaultFee!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  defaultDays!: number;
}

/** Admin: criar regra por prefixo de CEP */
export class AdminCreateShippingCepRuleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  cepPrefix!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  fee!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  estimatedDays!: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class AdminUpdateShippingCepRuleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  cepPrefix?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  fee?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  estimatedDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}


/** Query GET /admin/reports/sales?from=&to= (YYYY-MM-DD, America/Sao_Paulo) */
export class AdminSalesReportQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'from deve ser YYYY-MM-DD' })
  from?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'to deve ser YYYY-MM-DD' })
  to?: string;
}

/** Admin: SEO / identidade da loja */
export class AdminUpdateStoreSettingsDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  siteTitle!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(320)
  siteDescription!: string;

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsUrl({ require_protocol: true })
  @MaxLength(2000)
  ogImageUrl?: string | null;
}

/** Admin: criar banner da home */
export class AdminCreateBannerDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  alt?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  imageUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  linkUrl?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class AdminUpdateBannerDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  alt?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  linkUrl?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class AdminReorderBannersDto {
  @IsArray()
  @IsString({ each: true })
  orderedIds!: string[];
}
