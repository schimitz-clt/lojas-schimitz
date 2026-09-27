import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { availableQty } from './inventory.math';
import { demoPurchaseRejection } from '../catalog/demo-product';

/** COMANDO OMEGA: optional journal reference. When given, the movement is recorded exactly once. */
export type InventoryMovementRef = { orderId: string; orderItemId: string };
export type InventoryMovementKind = 'RESERVE' | 'RELEASE' | 'COMMIT' | 'RESTOCK';

@Injectable()
export class InventoryService {
  /**
   * Journals (orderItem, kind) in InventoryMovement inside the caller's transaction.
   * Returns false if this movement was already applied (caller must then skip the stock update),
   * which makes reserve/commit/release/restock idempotent per order item.
   */
  async journal(
    tx: Prisma.TransactionClient,
    ref: InventoryMovementRef | undefined,
    productId: string,
    kind: InventoryMovementKind,
    qty: number,
  ): Promise<boolean> {
    if (!ref) return true;
    const rows = await tx.$queryRaw<{ id: string }[]>`
      INSERT INTO "InventoryMovement" ("id", "orderId", "orderItemId", "productId", "kind", "qty", "createdAt")
      VALUES (${randomUUID()}, ${ref.orderId}, ${ref.orderItemId}, ${productId}, ${kind}, ${qty}, NOW())
      ON CONFLICT ("orderItemId", "kind") DO NOTHING
      RETURNING "id"
    `;
    return rows.length > 0;
  }

  available(qtyOnHand: number, qtyReserved: number) {
    return availableQty(qtyOnHand, qtyReserved);
  }

  /**
   * Reserva atômica (CAS): qtyReserved += qty se disponível >= qty.
   * Usado no create do pedido (awaiting_payment). Pagamento confirma via commitSale.
   */
  async reserve(tx: Prisma.TransactionClient, productId: string, qty: number, ref?: InventoryMovementRef) {
    if (qty < 1) {
      throw new BadRequestException({ message: 'Quantidade inválida', code: 'INVALID_QTY' });
    }
    await this.rejectDemo(tx, productId);
    if (!(await this.journal(tx, ref, productId, 'RESERVE', qty))) return;
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
  async release(tx: Prisma.TransactionClient, productId: string, qty: number, ref?: InventoryMovementRef) {
    if (qty < 1) {
      throw new BadRequestException({ message: 'Quantidade inválida', code: 'INVALID_QTY' });
    }
    if (!(await this.journal(tx, ref, productId, 'RELEASE', qty))) return 0;
    const rows = await tx.$executeRaw`
      UPDATE "Inventory"
      SET "qtyReserved" = "qtyReserved" - ${qty}
      WHERE "productId" = ${productId}
        AND "qtyReserved" >= ${qty}
    `;
    if (rows === 0) {
      throw new BadRequestException({
        message: 'Falha ao liberar reserva de estoque',
        code: 'INVENTORY_RELEASE_FAILED',
      });
    }
    return rows;
  }

  /** Confirma venda: baixa on-hand e reserva (pagamento aprovado). */
  async commitSale(tx: Prisma.TransactionClient, productId: string, qty: number, ref?: InventoryMovementRef) {
    if (qty < 1) {
      throw new BadRequestException({ message: 'Quantidade inválida', code: 'INVALID_QTY' });
    }
    await this.rejectDemo(tx, productId);
    if (!(await this.journal(tx, ref, productId, 'COMMIT', qty))) return;
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
  async restock(tx: Prisma.TransactionClient, productId: string, qty: number, ref?: InventoryMovementRef) {
    if (qty < 1) {
      throw new BadRequestException({ message: 'Quantidade inválida', code: 'INVALID_QTY' });
    }
    if (!(await this.journal(tx, ref, productId, 'RESTOCK', qty))) return 0;
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

  /**
   * Admin set qtyOnHand com predicado CAS: não permite onHand < qtyReserved
   * (evita TOCTOU entre leitura de reserved e update).
   */
  async setOnHandCas(tx: Prisma.TransactionClient, productId: string, qtyOnHand: number) {
    if (!Number.isFinite(qtyOnHand) || qtyOnHand < 0 || !Number.isInteger(qtyOnHand)) {
      throw new BadRequestException({ message: 'Estoque inválido', code: 'INVALID_STOCK' });
    }
    const existing = await tx.inventory.findUnique({ where: { productId } });
    if (!existing) {
      await tx.inventory.create({
        data: { productId, qtyOnHand, qtyReserved: 0 },
      });
      return;
    }
    const rows = await tx.$executeRaw`
      UPDATE "Inventory"
      SET "qtyOnHand" = ${qtyOnHand}
      WHERE "productId" = ${productId}
        AND "qtyReserved" <= ${qtyOnHand}
    `;
    if (rows === 0) {
      const fresh = await tx.inventory.findUnique({ where: { productId } });
      const reserved = fresh?.qtyReserved ?? 0;
      throw new BadRequestException(
        `Estoque não pode ser menor que a reserva atual (${reserved})`,
      );
    }
  }

  /** Demo nunca reserva nem confirma venda, mesmo com qtyOnHand alto. */
  private async rejectDemo(tx: Prisma.TransactionClient, productId: string) {
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { isDemo: true, name: true },
    });
    const rejection = demoPurchaseRejection(product);
    if (rejection) throw new BadRequestException(rejection);
  }
}
