import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import {
  commissionAmount,
  resolveCommissionPercent,
} from './commissions.constants';

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
            product: { select: { sellerId: true, seller: { select: { id: true, commissionPercent: true } } } },
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

  async listPending(limit = 100) {
    const rows = await this.prisma.commissionLedger.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 500),
      include: {
        seller: { select: { id: true, name: true, slug: true } },
        order: { select: { id: true, publicId: true, status: true, createdAt: true } },
        orderItem: { select: { id: true, name: true, qty: true, unitPrice: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      sellerId: r.sellerId,
      seller: r.seller,
      orderId: r.orderId,
      order: r.order,
      orderItemId: r.orderItemId,
      orderItem: {
        ...r.orderItem,
        unitPrice: Number(r.orderItem.unitPrice),
      },
      amount: Number(r.amount),
      percent: Number(r.percent),
      status: r.status,
      createdAt: r.createdAt,
    }));
  }
}
