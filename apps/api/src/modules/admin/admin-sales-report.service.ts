import { BadRequestException, Injectable } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import {
  PAID_REVENUE_STATUSES,
  aggregateByDay,
  aggregateBySeller,
  aggregateTopProducts,
  computeSalesSummary,
  parseSalesDateRange,
} from './admin-sales-report';

@Injectable()
export class AdminSalesReportService {
  constructor(private readonly prisma: PrismaService) {}

  async salesReport(query: { from?: string; to?: string }) {
    let range: ReturnType<typeof parseSalesDateRange>;
    try {
      range = parseSalesDateRange(query.from, query.to);
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Período inválido');
    }

    const createdInRange: Prisma.OrderWhereInput = {
      createdAt: { gte: range.fromDate, lt: range.toDateExclusive },
    };

    const paidStatuses = [...PAID_REVENUE_STATUSES] as OrderStatus[];

    const [paidOrders, statusGroups, paidItems] = await Promise.all([
      this.prisma.order.findMany({
        where: { ...createdInRange, status: { in: paidStatuses } },
        select: { id: true, total: true, createdAt: true },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        where: createdInRange,
        _count: { _all: true },
      }),
      this.prisma.orderItem.findMany({
        where: {
          order: { ...createdInRange, status: { in: paidStatuses } },
        },
        select: {
          orderId: true,
          productId: true,
          name: true,
          qty: true,
          unitPrice: true,
          sellerId: true,
          seller: { select: { id: true, name: true } },
        },
      }),
    ]);

    const summary = computeSalesSummary(paidOrders.map((o) => Number(o.total)));

    const byStatus: Record<string, number> = {};
    for (const g of statusGroups) {
      byStatus[g.status] = g._count._all;
    }

    const byDay = aggregateByDay(
      paidOrders.map((o) => ({
        createdAt: o.createdAt,
        total: Number(o.total),
      })),
    );

    const bySeller = aggregateBySeller(
      paidItems.map((it) => ({
        orderId: it.orderId,
        sellerId: it.sellerId,
        sellerName: it.seller?.name ?? null,
        qty: it.qty,
        unitPrice: Number(it.unitPrice),
      })),
    );

    const topProducts = aggregateTopProducts(
      paidItems.map((it) => ({
        productId: it.productId,
        name: it.name,
        qty: it.qty,
        unitPrice: Number(it.unitPrice),
      })),
      10,
    );

    return {
      from: range.from,
      to: range.to,
      timezone: 'America/Sao_Paulo',
      summary,
      byStatus,
      byDay,
      bySeller,
      topProducts,
    };
  }
}
