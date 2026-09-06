import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { assertSellerCanUpdateProduct } from './seller-portal.authz';
import { CommissionsService } from '../commissions/commissions.service';

@Injectable()
export class SellerPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commissions: CommissionsService,
  ) {}

  /** Resolve active seller owned by this user (ownerUserId). */
  async requireOwnedSeller(userId: string) {
    const seller = await this.prisma.seller.findFirst({
      where: { ownerUserId: userId },
      orderBy: { createdAt: 'asc' },
    });
    if (!seller) {
      throw new ForbiddenException({
        message: 'Conta não vinculada a um vendedor',
        code: 'NOT_A_SELLER',
      });
    }
    if (seller.status === 'suspended') {
      throw new ForbiddenException({
        message: 'Vendedor suspenso',
        code: 'SELLER_SUSPENDED',
      });
    }
    return seller;
  }

  async me(userId: string) {
    const seller = await this.requireOwnedSeller(userId);
    const productCount = await this.prisma.product.count({ where: { sellerId: seller.id } });
    return {
      id: seller.id,
      name: seller.name,
      slug: seller.slug,
      status: seller.status,
      commissionPercent:
        seller.commissionPercent != null ? Number(seller.commissionPercent) : null,
      productCount,
    };
  }

  async listProducts(userId: string) {
    const seller = await this.requireOwnedSeller(userId);
    const products = await this.prisma.product.findMany({
      where: { sellerId: seller.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        inventory: true,
        images: { orderBy: { position: 'asc' }, take: 1 },
        category: { select: { id: true, name: true, slug: true } },
      },
    });
    return products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      slug: p.slug,
      price: Number(p.price),
      compareAtPrice: p.compareAtPrice != null ? Number(p.compareAtPrice) : null,
      active: p.active,
      stock: p.inventory?.qtyOnHand ?? 0,
      reserved: p.inventory?.qtyReserved ?? 0,
      imageUrl: p.images[0]?.url ?? null,
      category: p.category,
    }));
  }

  async updateProduct(
    userId: string,
    productId: string,
    dto: { price?: number; stock?: number },
  ) {
    const seller = await this.requireOwnedSeller(userId);
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { inventory: true },
    });
    if (!product) throw new NotFoundException('Produto não encontrado');

    const gate = assertSellerCanUpdateProduct(seller.id, product.sellerId);
    if (!gate.ok) {
      throw new ForbiddenException({
        message: 'Você não pode editar produtos de outro vendedor',
        code: gate.code,
      });
    }

    if (dto.price == null && dto.stock == null) {
      throw new BadRequestException('Informe price e/ou stock');
    }
    if (dto.price != null && (Number.isNaN(dto.price) || dto.price < 0)) {
      throw new BadRequestException('Preço inválido');
    }
    if (dto.stock != null && (!Number.isInteger(dto.stock) || dto.stock < 0)) {
      throw new BadRequestException('Estoque inválido');
    }

    const data: Prisma.ProductUpdateInput = {};
    if (dto.price != null) data.price = new Prisma.Decimal(dto.price);

    const updated = await this.prisma.$transaction(async (tx) => {
      const p = await tx.product.update({
        where: { id: productId },
        data,
      });
      if (dto.stock != null) {
        await tx.inventory.upsert({
          where: { productId },
          update: { qtyOnHand: dto.stock },
          create: {
            productId,
            qtyOnHand: dto.stock,
            qtyReserved: 0,
          },
        });
      }
      const inv = await tx.inventory.findUnique({ where: { productId } });
      return { product: p, inventory: inv };
    });

    return {
      id: updated.product.id,
      name: updated.product.name,
      price: Number(updated.product.price),
      stock: updated.inventory?.qtyOnHand ?? 0,
      reserved: updated.inventory?.qtyReserved ?? 0,
    };
  }

  async listOrders(userId: string) {
    const seller = await this.requireOwnedSeller(userId);
    const items = await this.prisma.orderItem.findMany({
      where: { sellerId: seller.id },
      orderBy: { order: { createdAt: 'desc' } },
      take: 100,
      include: {
        order: {
          select: {
            id: true,
            publicId: true,
            status: true,
            total: true,
            createdAt: true,
            trackingCode: true,
            carrier: true,
          },
        },
      },
    });

    // Group by order
    const map = new Map<
      string,
      {
        orderId: string;
        publicId: string;
        status: string;
        orderTotal: number;
        createdAt: Date;
        trackingCode: string | null;
        carrier: string | null;
        items: { id: string; name: string; qty: number; unitPrice: number }[];
      }
    >();

    for (const it of items) {
      let row = map.get(it.orderId);
      if (!row) {
        row = {
          orderId: it.order.id,
          publicId: it.order.publicId,
          status: it.order.status,
          orderTotal: Number(it.order.total),
          createdAt: it.order.createdAt,
          trackingCode: it.order.trackingCode,
          carrier: it.order.carrier,
          items: [],
        };
        map.set(it.orderId, row);
      }
      row.items.push({
        id: it.id,
        name: it.name,
        qty: it.qty,
        unitPrice: Number(it.unitPrice),
      });
    }

    return [...map.values()];
  }

  /** Own commissions only (pending/approved/paid) + read-only totals. */
  async listCommissions(userId: string) {
    const seller = await this.requireOwnedSeller(userId);
    return this.commissions.listForSeller(seller.id);
  }
}
