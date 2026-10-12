/**
 * Diferenças (antes → depois) de um produto editado pelo admin, para a trilha de auditoria.
 * Só considera campos que vieram no DTO e que realmente mudaram. Função pura.
 */

export type ProductBefore = {
  name: string;
  sku: string;
  price: unknown; // Prisma.Decimal | number | string
  compareAtPrice?: unknown | null;
  active: boolean;
  badge?: string | null;
  inventory?: { qtyOnHand: number } | null;
};

export type ProductDtoLike = {
  name?: string;
  sku?: string;
  price?: number;
  compareAtPrice?: number | null;
  active?: boolean;
  badge?: string | null;
  stock?: number;
};

export type ProductChange = { from: unknown; to: unknown };

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(typeof v === 'object' ? String(v) : v);
  return Number.isFinite(n) ? n : null;
}

export function diffProductChanges(before: ProductBefore, dto: ProductDtoLike): Record<string, ProductChange> {
  const out: Record<string, ProductChange> = {};
  if (dto.price !== undefined && num(before.price) !== num(dto.price)) {
    out.price = { from: num(before.price), to: num(dto.price) };
  }
  if (dto.compareAtPrice !== undefined && num(before.compareAtPrice) !== num(dto.compareAtPrice)) {
    out.compareAtPrice = { from: num(before.compareAtPrice), to: num(dto.compareAtPrice) };
  }
  if (dto.stock !== undefined && (before.inventory?.qtyOnHand ?? null) !== dto.stock) {
    out.stock = { from: before.inventory?.qtyOnHand ?? null, to: dto.stock };
  }
  if (dto.active !== undefined && before.active !== dto.active) {
    out.active = { from: before.active, to: dto.active };
  }
  if (dto.name !== undefined && before.name !== dto.name.trim()) {
    out.name = { from: before.name, to: dto.name.trim() };
  }
  if (dto.sku !== undefined && before.sku !== dto.sku.trim()) {
    out.sku = { from: before.sku, to: dto.sku.trim() };
  }
  if (dto.badge !== undefined && (before.badge ?? null) !== (dto.badge?.trim() || null)) {
    out.badge = { from: before.badge ?? null, to: dto.badge?.trim() || null };
  }
  return out;
}
