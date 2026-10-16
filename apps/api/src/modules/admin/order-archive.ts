import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import type { Prisma } from '@prisma/client';

/**
 * Arquivar pedidos no admin. Apenas oculta da lista padrão: não toca status, pagamentos,
 * estoque, relatórios nem totais financeiros (receita conta pedidos pagos, arquivados ou não).
 */
export const ARCHIVABLE_ORDER_STATUSES = ['cancelled', 'refunded', 'delivered'] as const;
/** Pedidos encerrados sem venda: aba "Cancelados/expirados" (expirado vira cancelled pelo job de reservas). */
export const CLOSED_ORDER_STATUSES = ['cancelled', 'refunded'] as const;

export const ADMIN_ORDER_VIEWS = ['ativos', 'encerrados', 'arquivados', 'todos'] as const;
export type AdminOrderView = (typeof ADMIN_ORDER_VIEWS)[number];

export function isArchivableStatus(status: string): boolean {
  return (ARCHIVABLE_ORDER_STATUSES as readonly string[]).includes(status);
}

/**
 * Filtro da visão. Busca por texto (q) procura em tudo (inclui arquivados) para achar um SCH-… direto.
 * Filtro explícito de status respeita o status pedido, mas continua escondendo arquivados.
 */
export function adminOrderViewWhere(
  view: string | undefined,
  opts: { hasSearch: boolean; hasStatus: boolean },
): Prisma.OrderWhereInput {
  if (opts.hasSearch) return {};
  const v = (ADMIN_ORDER_VIEWS as readonly string[]).includes(view || '') ? (view as AdminOrderView) : 'ativos';
  if (v === 'todos') return {};
  if (v === 'arquivados') return { archivedAt: { not: null } };
  if (v === 'encerrados') return { archivedAt: null, status: { in: [...CLOSED_ORDER_STATUSES] } };
  if (opts.hasStatus) return { archivedAt: null };
  return { archivedAt: null, status: { notIn: [...CLOSED_ORDER_STATUSES] } };
}

export type ArchivePlan = { apply: string[]; skipped: { id: string; publicId: string | null; reason: string }[] };

export function planOrderArchive(
  orders: { id: string; publicId?: string | null; status: string; archivedAt?: Date | null }[],
  requested: string[],
  archive: boolean,
): ArchivePlan {
  const byId = new Map(orders.map((o) => [o.id, o]));
  const plan: ArchivePlan = { apply: [], skipped: [] };
  for (const id of [...new Set(requested)]) {
    const o = byId.get(id);
    if (!o) {
      plan.skipped.push({ id, publicId: null, reason: 'Pedido não encontrado' });
      continue;
    }
    const pub = o.publicId ?? null;
    if (archive) {
      if (o.archivedAt) plan.skipped.push({ id, publicId: pub, reason: 'Já arquivado' });
      else if (!isArchivableStatus(o.status))
        plan.skipped.push({ id, publicId: pub, reason: 'Só cancelados, expirados, estornados ou entregues podem ser arquivados' });
      else plan.apply.push(id);
    } else if (!o.archivedAt) plan.skipped.push({ id, publicId: pub, reason: 'Não está arquivado' });
    else plan.apply.push(id);
  }
  return plan;
}

export class AdminOrderArchiveDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  ids!: string[];

  @ApiPropertyOptional({ description: 'true arquiva (padrão), false desarquiva' })
  @IsOptional()
  @IsBoolean()
  archive?: boolean;
}

export class AdminOrderViewQuery {
  @IsOptional()
  @IsIn([...ADMIN_ORDER_VIEWS])
  view?: string;
}
