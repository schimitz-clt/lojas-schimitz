import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class InventoryService {
  available(qtyOnHand: number, qtyReserved: number) {
    return Math.max(0, qtyOnHand - qtyReserved);
  }

  /**
   * Reserva atômica (CAS): qtyReserved += qty se disponível >= qty.
   * Usado no create do pedido (awaiting_payment). Pagamento confirma via commitSale.
   */
  async reserve(tx: Prisma.TransactionClient, productId: string, qty: number) {
    if (qty < 1) {
      throw new BadRequestException({ message: 'Quantidade inválida', code: 'INVALID_QTY' });
    }
    const inv = await tx.inventory.findUnique({ where: { productId } });
    if (!inv) {
      throw new BadRequestException({
        message: 'Produto sem inventário configurado',
        code: 'INVENTORY_MISSING',
      });
    }
    const rows = await tx.$executeRaw`
      UPDATE "Inventory"
      SET "qtyReserved" = "qtyReserved" + ${qty}
      WHERE "productId" = ${productId}
        AND ("qtyOnHand" - "qtyReserved") >= ${qty}
    `;
    if (rows === 0) {
      throw new BadRequestException({
        message: 'Produto sem estoque suficiente',
        code: 'INSUFFICIENT_STOCK',
      });
    }
  }

  /** Libera reserva (cancelamento / expiração de unpaid). */
  async release(tx: Prisma.TransactionClient, productId: string, qty: number) {
    const rows = await tx.$executeRaw`
      UPDATE "Inventory"
      SET "qtyReserved" = "qtyReserved" - ${qty}
      WHERE "productId" = ${productId}
        AND "qtyReserved" >= ${qty}
    `;
    return rows;
  }

  /** Confirma venda: baixa on-hand e reserva (pagamento aprovado). */
  async commitSale(tx: Prisma.TransactionClient, productId: string, qty: number) {
    const rows = await tx.$executeRaw`
      UPDATE "Inventory"
      SET "qtyOnHand" = "qtyOnHand" - ${qty},
          "qtyReserved" = "qtyReserved" - ${qty}
      WHERE "productId" = ${productId}
        AND "qtyReserved" >= ${qty}
        AND "qtyOnHand" >= ${qty}
    `;
    if (rows === 0) {
      throw new BadRequestException({
        message: 'Estoque inconsistente para confirmar venda',
        code: 'INVENTORY_COMMIT_FAILED',
      });
    }
  }

  async reserveCoupon(tx: Prisma.TransactionClient, couponId: string) {
    const rows = await tx.$executeRaw`
      UPDATE "Coupon"
      SET "reservedCount" = "reservedCount" + 1
      WHERE "id" = ${couponId}
        AND "active" = true
        AND (
          "maxUses" IS NULL
          OR ("usedCount" + "reservedCount") < "maxUses"
        )
    `;
    if (rows === 0) {
      throw new BadRequestException({ message: 'Cupom esgotado', code: 'COUPON_EXHAUSTED' });
    }
  }

  async consumeCoupon(tx: Prisma.TransactionClient, couponId: string) {
    await tx.$executeRaw`
      UPDATE "Coupon"
      SET "reservedCount" = GREATEST(0, "reservedCount" - 1),
          "usedCount" = "usedCount" + 1
      WHERE "id" = ${couponId}
        AND "reservedCount" >= 1
    `;
  }

  async releaseCoupon(tx: Prisma.TransactionClient, couponId: string) {
    await tx.$executeRaw`
      UPDATE "Coupon"
      SET "reservedCount" = "reservedCount" - 1
      WHERE "id" = ${couponId}
        AND "reservedCount" >= 1
    `;
  }

  /** Reposição após estorno de Order ainda no depósito. NÃO altera o predicado CAS. */
  async restock(tx: Prisma.TransactionClient, productId: string, qty: number) {
    const rows = await tx.$executeRaw`
      UPDATE "Inventory"
      SET "qtyOnHand" = "qtyOnHand" + ${qty}
      WHERE "productId" = ${productId}
    `;
    if (rows === 0) {
      throw new BadRequestException({
        message: 'Inventário não encontrado para restock',
        code: 'INVENTORY_RESTOCK_FAILED',
      });
    }
    return rows;
  }
}
