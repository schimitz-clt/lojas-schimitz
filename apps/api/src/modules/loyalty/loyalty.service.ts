import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma.service';

/** Taxa SCHIMITZ+ v1: 1% do total pago. */
export const CASHBACK_RATE = 0.01;

function money(n: number | Decimal | string) {
  return new Decimal(n).toDecimalPlaces(2);
}

@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}

  /** Calcula cashback a creditar (1% do total pago). */
  earnAmount(paidTotal: number): number {
    if (paidTotal <= 0) return 0;
    return Number(money(paidTotal * CASHBACK_RATE));
  }

  async getBalance(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { cashbackBalance: true },
    });
    return {
      balance: Number(user?.cashbackBalance ?? 0),
      rate: CASHBACK_RATE,
      label: 'SCHIMITZ+',
    };
  }

  async getSummary(userId: string) {
    const [balance, recent] = await Promise.all([
      this.getBalance(userId),
      this.prisma.cashbackLedger.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          kind: true,
          amount: true,
          balanceAfter: true,
          note: true,
          orderId: true,
          createdAt: true,
        },
      }),
    ]);
    return {
      ...balance,
      recent: recent.map((r) => ({
        ...r,
        amount: Number(r.amount),
        balanceAfter: Number(r.balanceAfter),
      })),
    };
  }

  /**
   * Debita saldo no create do pedido (redeem). Idempotente por orderId+kind.
   * Deve rodar dentro da mesma transaction do pedido.
   */
  async redeemInTx(
    tx: Prisma.TransactionClient,
    userId: string,
    orderId: string,
    amount: number,
  ) {
    const amt = money(amount);
    if (amt.lte(0)) return;

    const existing = await tx.cashbackLedger.findUnique({
      where: { orderId_kind: { orderId, kind: 'redeem' } },
    });
    if (existing) return;

    const rows = await tx.$executeRaw`
      UPDATE "User"
      SET "cashbackBalance" = "cashbackBalance" - ${amt}
      WHERE "id" = ${userId}
        AND "cashbackBalance" >= ${amt}
    `;
    if (rows === 0) {
      throw new BadRequestException({
        message: 'Saldo SCHIMITZ+ insuficiente',
        code: 'CASHBACK_INSUFFICIENT',
      });
    }
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { cashbackBalance: true },
    });
    await tx.cashbackLedger.create({
      data: {
        userId,
        orderId,
        kind: 'redeem',
        amount: amt,
        balanceAfter: user.cashbackBalance,
        note: 'Resgate no checkout',
      },
    });
  }

  /** Devolve cashback ao cancelar pedido awaiting_payment. */
  async refundRedeemInTx(
    tx: Prisma.TransactionClient,
    userId: string,
    orderId: string,
    amount: number,
  ) {
    const amt = money(amount);
    if (amt.lte(0)) return;

    const existing = await tx.cashbackLedger.findUnique({
      where: { orderId_kind: { orderId, kind: 'refund' } },
    });
    if (existing) return;

    const redeem = await tx.cashbackLedger.findUnique({
      where: { orderId_kind: { orderId, kind: 'redeem' } },
    });
    if (!redeem) return;

    await tx.$executeRaw`
      UPDATE "User"
      SET "cashbackBalance" = "cashbackBalance" + ${amt}
      WHERE "id" = ${userId}
    `;
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { cashbackBalance: true },
    });
    await tx.cashbackLedger.create({
      data: {
        userId,
        orderId,
        kind: 'refund',
        amount: amt,
        balanceAfter: user.cashbackBalance,
        note: 'Estorno de resgate (pedido cancelado)',
      },
    });
  }

  /**
   * Credita 1% do total pago após order → paid. Idempotente (orderId+earn).
   * Pode rodar fora de tx curta; usa CAS no ledger unique.
   */
  async creditEarnOnPaid(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, userId: true, total: true, status: true },
    });
    if (!order?.userId) return { credited: false, reason: 'no_user' };
    if (order.status !== 'paid' && order.status !== 'separating' && order.status !== 'shipped' && order.status !== 'delivered') {
      return { credited: false, reason: 'not_paid' };
    }

    const amount = this.earnAmount(Number(order.total));
    if (amount <= 0) return { credited: false, reason: 'zero' };

    const amt = money(amount);
    try {
      await this.prisma.$transaction(async (tx) => {
        const existing = await tx.cashbackLedger.findUnique({
          where: { orderId_kind: { orderId, kind: 'earn' } },
        });
        if (existing) return;

        await tx.$executeRaw`
          UPDATE "User"
          SET "cashbackBalance" = "cashbackBalance" + ${amt}
          WHERE "id" = ${order.userId!}
        `;
        const user = await tx.user.findUniqueOrThrow({
          where: { id: order.userId! },
          select: { cashbackBalance: true },
        });
        await tx.cashbackLedger.create({
          data: {
            userId: order.userId!,
            orderId,
            kind: 'earn',
            amount: amt,
            balanceAfter: user.cashbackBalance,
            note: `Cashback SCHIMITZ+ (${(CASHBACK_RATE * 100).toFixed(0)}%)`,
          },
        });
      });
      return { credited: true, amount };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return { credited: false, reason: 'already' };
      }
      throw e;
    }
  }
}
