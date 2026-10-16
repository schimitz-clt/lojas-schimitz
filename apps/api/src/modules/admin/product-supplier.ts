/**
 * Fornecedor/custo por produto (Prime). Regras puras + DTO.
 * Nunca exposto na vitrine: tabela ProductSupplier só é lida pelo controller admin.
 */
import { Transform, Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';

const trimOrNull = ({ value }: { value: unknown }) => {
  if (value == null) return null;
  const s = String(value).trim();
  return s === '' ? null : s;
};

export class AdminProductSupplierDto {
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  supplierName!: string;

  @IsOptional()
  @Transform(trimOrNull)
  @ValidateIf((_, v) => v != null)
  @IsString()
  @MaxLength(80)
  supplierSku?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @ValidateIf((_, v) => v != null)
  @IsUrl({ protocols: ['https', 'http'], require_protocol: true })
  @MaxLength(500)
  supplierUrl?: string | null;

  @IsOptional()
  @Transform(({ value }) => (value == null || value === '' ? null : Number(String(value).replace(',', '.'))))
  @ValidateIf((_, v) => v != null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000)
  costPrice?: number | null;

  @IsOptional()
  @Transform(({ value }) => (value == null || value === '' ? null : Number(value)))
  @ValidateIf((_, v) => v != null)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  leadTimeDays?: number | null;

  @IsOptional()
  @Transform(trimOrNull)
  @ValidateIf((_, v) => v != null)
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}

export type ProductSupplierView = {
  productId: string;
  supplierName: string;
  supplierSku: string | null;
  supplierUrl: string | null;
  costPrice: number | null;
  leadTimeDays: number | null;
  notes: string | null;
  updatedAt: string;
};

export function toProductSupplierView(row: {
  productId: string;
  supplierName: string;
  supplierSku: string | null;
  supplierUrl: string | null;
  costPrice: unknown;
  leadTimeDays: number | null;
  notes: string | null;
  updatedAt: Date;
}): ProductSupplierView {
  return {
    productId: row.productId,
    supplierName: row.supplierName,
    supplierSku: row.supplierSku,
    supplierUrl: row.supplierUrl,
    costPrice: row.costPrice == null ? null : Number(row.costPrice),
    leadTimeDays: row.leadTimeDays,
    notes: row.notes,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Margem bruta real (preço − custo) / preço. null sem custo ou preço inválido — nunca estimada. */
export function grossMarginPct(price: number, cost: number | null): number | null {
  if (cost == null || !Number.isFinite(cost) || !Number.isFinite(price) || price <= 0) return null;
  return Math.round(((price - cost) / price) * 1000) / 10;
}
