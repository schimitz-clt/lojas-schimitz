import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
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
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { IsRealProductImageUrl } from './is-real-product-image-url';

export class ProductFeatureDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  label!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  value!: string;
}

export class ProductFaqDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  question!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(600)
  answer!: string;
}

export class StoreTrustItemDto {
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  title!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(140)
  body!: string;
}

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
  @IsUUID()
  sellerId?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  /** URL pública da imagem (upload local /uploads ou URL externa). Placeholder CDN é recusado. */
  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsUrl({ require_protocol: true })
  @MaxLength(2000)
  @IsRealProductImageUrl()
  imageUrl?: string | null;

  /** Fotos extras (além da capa). Dedupes com imageUrl; máx. MAX_PRODUCT_IMAGES no service. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsUrl({ require_protocol: true }, { each: true })
  @MaxLength(2000, { each: true })
  @IsRealProductImageUrl({ each: true })
  imageUrls?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  badge?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  highlights?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => ProductFeatureDto)
  features?: ProductFeatureDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  boxContents?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => ProductFaqDto)
  faq?: ProductFaqDto[];
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
  @IsUUID()
  sellerId?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  /** Real cover URL only. Empty/null is ignored — does not delete ProductImage rows. Placeholder CDN é recusado. */
  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsUrl({ require_protocol: true })
  @MaxLength(2000)
  @IsRealProductImageUrl()
  imageUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  badge?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  highlights?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => ProductFeatureDto)
  features?: ProductFeatureDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  boxContents?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => ProductFaqDto)
  faq?: ProductFaqDto[];
}

/** Query GET /admin/orders?status=&q=&take= */
export class AdminOrdersQueryDto {
  @IsOptional()
  @IsString()
  @IsIn([
    'draft',
    'awaiting_payment',
    'paid',
    'separating',
    'organizing',
    'packing',
    'ready_for_pickup',
    'shipped',
    'in_transit',
    'delivered',
    'cancelled',
    'refunded',
    /** Virtual ops bucket: Pedidos filter = cancelled|refunded + legado stuck (separating|shipped). CRITICAL alerts use stuck only. */
    'problems',
  ])
  status?: string;

  /** Server search: publicId prefix, email, customer name (min 3 or SCH-…). */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  /** Only applied when q triggers server search; capped at 50. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  take?: number;
}

/** Query GET /admin/products. Sem q/page/pageSize/active a resposta continua um array. */
export class AdminProductsQueryDto {
  /** Se informado, retorna só produtos com qtyOnHand <= este valor. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lowStock?: number;

  /** Busca por SKU ou nome. Liga a resposta paginada. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === true || value === 'true' || value === '1' || value === 'ativo') return true;
    if (value === false || value === 'false' || value === '0' || value === 'inativo') return false;
    return value;
  })
  @IsBoolean()
  active?: boolean;
}

/** CSV de catálogo. Validado antes de gravar. Não apaga produtos. */
export class AdminImportProductsDto {
  @IsString()
  @MinLength(1, { message: 'CSV vazio. Nada foi gravado.' })
  @MaxLength(450_000, { message: 'CSV grande demais. Divida o arquivo. Nada foi gravado.' })
  csv!: string;
}

/** Lote explícito por SKU. Sem lista, nada é alterado. */
export class AdminProductBatchDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Informe ao menos um SKU. Nenhum produto foi alterado.' })
  @ArrayMaxSize(200, { message: 'Máximo de 200 SKUs por lote. Nenhum produto foi alterado.' })
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  skus!: string[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsIn(['set', 'percent'])
  priceMode?: 'set' | 'percent';

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  priceValue?: number;

  @IsOptional()
  @IsIn(['set', 'delta'])
  stockMode?: 'set' | 'delta';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  stockValue?: number;
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

  /** Vazio limpa. Dígitos ou máscara; a API valida os verificadores. */
  @IsOptional()
  @IsString()
  @MaxLength(18)
  cnpj?: string | null;

  /** ISO 8601. Vazio limpa e a home deixa de contar. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  promoEndsAt?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  @MaxLength(48, { each: true })
  promoLines?: string[] | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => StoreTrustItemDto)
  trustItems?: StoreTrustItemDto[] | null;
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

/** Admin: criar outro administrador */
export class AdminCreateAdminDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, { message: 'Senha deve ter letras e números' })
  password!: string;
}

/** Admin: ativar/desativar administrador (status active|blocked) */
export class AdminUpdateAdminStatusDto {
  @IsIn(['active', 'blocked'])
  status!: 'active' | 'blocked';
}

/** Admin: criar vendedor (marketplace v1) */
export class AdminCreateSellerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  slug?: string;

  @IsOptional()
  @IsIn(['pending', 'active', 'suspended'])
  status?: 'pending' | 'active' | 'suspended';

  @IsOptional()
  @IsUUID()
  ownerUserId?: string | null;

  /** Stub marketplace v2 — não usado no checkout. */
  @IsOptional()
  @Type(() => Number)
  @ValidateIf((_, v) => v != null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  commissionPercent?: number | null;
}

export class AdminUpdateSellerStatusDto {
  @IsIn(['pending', 'active', 'suspended'])
  status!: 'pending' | 'active' | 'suspended';
}

/** Admin: vincular dono (user id ou e-mail) + opcional commissionPercent */
export class AdminUpdateSellerOwnerDto {
  @IsOptional()
  @IsUUID()
  ownerUserId?: string | null;

  @IsOptional()
  @IsEmail()
  ownerEmail?: string | null;

  @IsOptional()
  @Type(() => Number)
  @ValidateIf((_, v) => v != null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  commissionPercent?: number | null;
}

/** Admin: optional note when approving a commission (pending → approved). */
export class AdminApproveCommissionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** Admin: mark commission paid (pending|approved → paid) with optional PIX reference. */
export class AdminMarkCommissionPaidDto {
  /** PIX end-to-end id or manual transfer reference. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  payoutReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}


/** Query GET /admin/customers?q=&take=&skip= — CRM read-only */
export class AdminCustomersQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  take?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;
}

/** Máximo de fotos por produto (admin + PDP). */
export const MAX_PRODUCT_IMAGES = 10;

export class AdminAddProductImageDto {
  @IsUrl({ require_protocol: true })
  @MaxLength(2000)
  @IsRealProductImageUrl()
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  alt?: string;
}

export class AdminReorderProductImagesDto {
  @IsArray()
  @IsString({ each: true })
  orderedIds!: string[];
}
