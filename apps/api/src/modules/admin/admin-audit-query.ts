/** Consulta do registro de atividades do admin (GET /admin/audit-log). Funções puras. */
import type { Prisma } from '@prisma/client';

export const AUDIT_LOG_DEFAULT_TAKE = 50;
export const AUDIT_LOG_MAX_TAKE = 200;

export type AuditLogQuery = {
  actorId?: string;
  entity?: string;
  entityId?: string;
  action?: string;
  from?: string;
  to?: string;
  take?: number;
  skip?: number;
};

export function clampAuditTake(n: unknown): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v < 1) return AUDIT_LOG_DEFAULT_TAKE;
  return Math.min(v, AUDIT_LOG_MAX_TAKE);
}

export function clampAuditSkip(n: unknown): number {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) && v > 0 ? Math.min(v, 100_000) : 0;
}

function validDate(s?: string): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function buildAuditLogWhere(q: AuditLogQuery): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};
  if (q.actorId) where.actorId = q.actorId;
  if (q.entity) where.entity = q.entity;
  if (q.entityId) where.entityId = q.entityId;
  if (q.action) where.action = { contains: q.action, mode: 'insensitive' };
  const from = validDate(q.from);
  const to = validDate(q.to);
  if (from || to) where.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
  return where;
}
