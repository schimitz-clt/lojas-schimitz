import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CommissionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import {
  COMMISSION_STATUSES,
  canTransitionCommission,
  commissionAmount,
  resolveCommissionPercent,
  type CommissionStatusValue,
} from './commissions.constants';

export type CommissionListQuery = {
  status?: string;
  sellerId?: string;
  limit?: number;
};

@Injectable()
export class CommissionsService {
  private readonly log = new Logger(CommissionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * On paid order: one CommissionLedger row per order item with sellerId.
   * Idempotent via unique orderItemId. No real payout.
   */
  async recordOnPaid(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            seller: { select: { id: true, commissionPercent: true } },
            product: {
              select: {
                sellerId: true,
                seller: { select: { id: true, commissionPercent: true } },
              },
            },
          },
        },
      },
    });
    if (!order) return { recorded: 0, reason: 'missing_order' };

    let recorded = 0;
    for (const item of order.items) {
      const sellerId = item.sellerId || item.product?.sellerId || item.seller?.id;
      if (!sellerId) continue;

      const seller = item.seller || item.product?.seller;
      const percent = resolveCommissionPercent(
        seller?.commissionPercent != null ? Number(seller.commissionPercent) : null,
      );
      const itemTotal = Number(item.unitPrice) * item.qty;
      const amount = commissionAmount(itemTotal, percent);
      if (amount <= 0) continue;

      try {
        await this.prisma.commissionLedger.create({
          data: {
            sellerId,
            orderId: order.id,
            orderItemId: item.id,
            amount: new Prisma.Decimal(amount),
            percent: new Prisma.Decimal(percent),
            status: 'pending',
          },
        });
        recorded += 1;
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          continue; // already recorded
        }
        this.log.warn(`commission create failed item=${item.id}: ${(e as Error)?.message || e}`);
      }
    }
    return { recorded, reason: recorded ? 'ok' : 'none' };
  }

  private mapRow(r: {
    id: string;
    sellerId: string;
    orderId: string;
    orderItemId: string;
    amount: Prisma.Decimal;
    percent: Prisma.Decimal;
    status: CommissionStatus;
    payoutReference: string | null;
    payoutNote: string | null;
    approvedAt: Date | null;
    paidAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    seller?: { id: string; name: string; slug: string };
    order?: { id: string; publicId: string; status: string; createdAt: Date };
    orderItem?: { id: string; name: string; qty: number; unitPrice: Prisma.Decimal };
  }) {
    return {
      id: r.id,
      sellerId: r.sellerId,
      seller: r.seller,
      orderId: r.orderId,
      order: r.order,
      orderItemId: r.orderItemId,
      orderItem: r.orderItem
        ? {
            ...r.orderItem,
            unitPrice: Number(r.orderItem.unitPrice),
          }
        : undefined,
      amount: Number(r.amount),
      percent: Number(r.percent),
      status: r.status,
      payoutReference: r.payoutReference,
      payoutNote: r.payoutNote,
      approvedAt: r.approvedAt,
      paidAt: r.paidAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  private parseStatusFilter(status?: string): CommissionStatus | undefined {
    if (!status || status === 'all') return undefined;
    if (!(COMMISSION_STATUSES as readonly string[]).includes(status)) {
      throw new BadRequestException(
        `status inválido (use ${COMMISSION_STATUSES.join('|')}|all)`,
      );
    }
    return status as CommissionStatus;
  }

  async list(query: CommissionListQuery = {}) {
    const limit = Math.min(Math.max(query.limit ?? 100, 1), 500);
    const status = this.parseStatusFilter(query.status ?? 'pending');
    const where: Prisma.CommissionLedgerWhereInput = {};
    if (status) where.status = status;
    if (query.sellerId) where.sellerId = query.sellerId;

    const rows = await this.prisma.commissionLedger.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        seller: { select: { id: true, name: true, slug: true } },
        order: { select: { id: true, publicId: true, status: true, createdAt: true } },
        orderItem: { select: { id: true, name: true, qty: true, unitPrice: true } },
      },
    });
    return rows.map((r) => this.mapRow(r));
  }

  /** @deprecated prefer list({ status: 'pending' }) */
  async listPending(limit = 100) {
    return this.list({ status: 'pending', limit });
  }

  async approve(id: string, note?: string) {
    const row = await this.prisma.commissionLedger.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Comissão não encontrada');
    if (!canTransitionCommission(row.status, 'approved')) {
      throw new BadRequestException({
        message: `Não é possível aprovar a partir de status=${row.status}`,
        code: 'INVALID_COMMISSION_TRANSITION',
      });
    }
    const updated = await this.prisma.commissionLedger.update({
      where: { id },
      data: {
        status: 'approved',
        approvedAt: new Date(),
        payoutNote: note?.trim() ? note.trim().slice(0, 500) : row.payoutNote,
      },
      include: {
        seller: { select: { id: true, name: true, slug: true } },
        order: { select: { id: true, publicId: true, status: true, createdAt: true } },
        orderItem: { select: { id: true, name: true, qty: true, unitPrice: true } },
      },
    });
    return this.mapRow(updated);
  }

  /**
   * Mark paid from pending (single-step) or approved.
   * Optional payoutReference = PIX end-to-end id / manual note.
   */
  async markPaid(
    id: string,
    opts: { payoutReference?: string; note?: string } = {},
  ) {
    const row = await this.prisma.commissionLedger.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Comissão não encontrada');
    if (!canTransitionCommission(row.status, 'paid')) {
      throw new BadRequestException({
        message: `Não é possível marcar pago a partir de status=${row.status}`,
        code: 'INVALID_COMMISSION_TRANSITION',
      });
    }
    const now = new Date();
    const data: Prisma.CommissionLedgerUpdateInput = {
      status: 'paid',
      paidAt: now,
    };
    if (row.status === 'pending' && !row.approvedAt) {
      data.approvedAt = now;
    }
    if (opts.payoutReference != null) {
      const ref = String(opts.payoutReference).trim().slice(0, 120);
      data.payoutReference = ref || null;
    }
    if (opts.note != null) {
      const note = String(opts.note).trim().slice(0, 500);
      data.payoutNote = note || null;
    }

    const updated = await this.prisma.commissionLedger.update({
      where: { id },
      data,
      include: {
        seller: { select: { id: true, name: true, slug: true } },
        order: { select: { id: true, publicId: true, status: true, createdAt: true } },
        orderItem: { select: { id: true, name: true, qty: true, unitPrice: true } },
      },
    });
    return this.mapRow(updated);
  }

  /** Seller portal: only rows for this sellerId + read-only totals. */
  async listForSeller(sellerId: string, limit = 100) {
    const take = Math.min(Math.max(limit, 1), 500);
    const rows = await this.prisma.commissionLedger.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        order: { select: { id: true, publicId: true, status: true, createdAt: true } },
        orderItem: { select: { id: true, name: true, qty: true, unitPrice: true } },
      },
    });

    const items = rows.map((r) => this.mapRow(r));
    const totals = { pending: 0, approved: 0, paid: 0, cancelled: 0, all: 0 };
    for (const it of items) {
      const key = it.status as CommissionStatusValue;
      if (key in totals) totals[key] += it.amount;
      totals.all += it.amount;
    }
    // Round to 2 decimals
    for (const k of Object.keys(totals) as (keyof typeof totals)[]) {
      totals[k] = Math.round(totals[k] * 100 + Number.EPSILON) / 100;
    }
    return { items, totals };
  }

  /** CSV of commissions for admin (typically pending for one seller). */
  async exportCsv(query: { sellerId: string; status?: string }) {
    if (!query.sellerId) {
      throw new BadRequestException('sellerId é obrigatório para export CSV');
    }
    const status = this.parseStatusFilter(query.status ?? 'pending');
    const where: Prisma.CommissionLedgerWhereInput = { sellerId: query.sellerId };
    if (status) where.status = status;

    const rows = await this.prisma.commissionLedger.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: 2000,
      include: {
        seller: { select: { id: true, name: true, slug: true } },
        order: { select: { publicId: true } },
        orderItem: { select: { name: true, qty: true, unitPrice: true } },
      },
    });

    const esc = (v: string | number | null | undefined) => {
      const s = v == null ? '' : String(v);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const header = [
      'id',
      'sellerId',
      'sellerName',
      'sellerSlug',
      'orderPublicId',
      'itemName',
      'qty',
      'unitPrice',
      'amount',
      'percent',
      'status',
      'payoutReference',
      'payoutNote',
      'createdAt',
      'approvedAt',
      'paidAt',
    ].join(',');

    const lines = rows.map((r) =>
      [
        esc(r.id),
        esc(r.sellerId),
        esc(r.seller.name),
        esc(r.seller.slug),
        esc(r.order.publicId),
        esc(r.orderItem.name),
        esc(r.orderItem.qty),
        esc(Number(r.orderItem.unitPrice)),
        esc(Number(r.amount)),
        esc(Number(r.percent)),
        esc(r.status),
        esc(r.payoutReference),
        esc(r.payoutNote),
        esc(r.createdAt.toISOString()),
        esc(r.approvedAt?.toISOString() ?? ''),
        esc(r.paidAt?.toISOString() ?? ''),
      ].join(','),
    );

    return {
      filename: `commissions-${query.sellerId.slice(0, 8)}-${status || 'all'}.csv`,
      csv: [header, ...lines].join('\n') + '\n',
      count: rows.length,
    };
  }
}
