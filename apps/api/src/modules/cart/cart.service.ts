import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { randomUUID } from 'crypto';
import { AddCartItemDto, UpdateCartItemDto } from './dto';

@Injectable()
export class CartService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async resolveCart(userId?: string, guestToken?: string) {
    if (userId) {
      let cart = await this.prisma.cart.findFirst({
        where: { userId },
        include: this.cartInclude(),
      });
      if (!cart) {
        cart = await this.prisma.cart.create({
          data: { userId },
          include: this.cartInclude(),
        });
      }
      return cart;
    }

    if (guestToken) {
      let cart = await this.prisma.cart.findFirst({
        where: { guestToken },
        include: this.cartInclude(),
      });
      if (!cart) {
        cart = await this.prisma.cart.create({
          data: { guestToken },
          include: this.cartInclude(),
        });
      }
      return cart;
    }

    const token = randomUUID();
    return this.prisma.cart.create({
      data: { guestToken: token },
      include: this.cartInclude(),
    });
  }

  private cartInclude() {
    return {
      items: {
        include: {
          product: {
            include: {
              images: { orderBy: { position: 'asc' as const }, take: 1 },
              inventory: true,
            },
          },
        },
      },
    };
  }

  private format(cart: Awaited<ReturnType<typeof this.resolveCart>>) {
    const items = cart.items.map((item) => {
      const price = Number(item.product.price);
      return {
        id: item.id,
        productId: item.productId,
        qty: item.qty,
        name: item.product.name,
        slug: item.product.slug,
        price,
        image: item.product.images[0]?.url ?? null,
        stock: item.product.inventory
          ? item.product.inventory.qtyOnHand - item.product.inventory.qtyReserved
          : 0,
        lineTotal: price * item.qty,
      };
    });
    const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
    return {
      id: cart.id,
      guestToken: cart.guestToken,
      items,
      subtotal,
      itemCount: items.reduce((s, i) => s + i.qty, 0),
    };
  }

  async getCart(userId?: string, guestToken?: string) {
    const cart = await this.resolveCart(userId, guestToken);
    return this.format(cart);
  }

  async addItem(dto: AddCartItemDto, userId?: string, guestToken?: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: { inventory: true },
    });
    if (!product || !product.active) throw new NotFoundException('Produto não encontrado');

    const available = product.inventory
      ? product.inventory.qtyOnHand - product.inventory.qtyReserved
      : 0;
    if (available < dto.qty) throw new BadRequestException('Estoque insuficiente');

    const cart = await this.resolveCart(userId, guestToken);

    const existing = await this.prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId: dto.productId } },
    });

    if (existing) {
      const newQty = existing.qty + dto.qty;
      if (available < newQty) throw new BadRequestException('Estoque insuficiente');
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { qty: newQty },
      });
    } else {
      await this.prisma.cartItem.create({
        data: { cartId: cart.id, productId: dto.productId, qty: dto.qty },
      });
    }

    return this.getCart(userId, cart.guestToken ?? guestToken);
  }

  async updateItem(itemId: string, dto: UpdateCartItemDto, userId?: string, guestToken?: string) {
    const cart = await this.resolveCart(userId, guestToken);
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
      include: { product: { include: { inventory: true } } },
    });
    if (!item) throw new NotFoundException('Item não encontrado no carrinho');

    const available = item.product.inventory
      ? item.product.inventory.qtyOnHand - item.product.inventory.qtyReserved
      : 0;
    if (available < dto.qty) throw new BadRequestException('Estoque insuficiente');

    await this.prisma.cartItem.update({ where: { id: itemId }, data: { qty: dto.qty } });
    return this.getCart(userId, cart.guestToken ?? guestToken);
  }

  async removeItem(itemId: string, userId?: string, guestToken?: string) {
    const cart = await this.resolveCart(userId, guestToken);
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
    });
    if (!item) throw new NotFoundException('Item não encontrado no carrinho');
    await this.prisma.cartItem.delete({ where: { id: itemId } });
    return this.getCart(userId, cart.guestToken ?? guestToken);
  }

  async clear(userId?: string, guestToken?: string) {
    const cart = await this.resolveCart(userId, guestToken);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return this.getCart(userId, cart.guestToken ?? guestToken);
  }

  /**
   * Merge guest cart into the authenticated user cart.
   * Revalidates product active + available stock; caps qty; drops invalid lines.
   * Deletes the guest cart afterwards. Idempotent if guest cart missing/empty.
   */
  async mergeGuestIntoUser(userId: string, guestToken?: string | null) {
    const token = (guestToken || '').trim();
    if (!userId || !token) {
      return this.getCart(userId);
    }

    const guestCart = await this.prisma.cart.findFirst({
      where: { guestToken: token },
      include: {
        items: {
          include: { product: { include: { inventory: true } } },
        },
      },
    });
    if (!guestCart || guestCart.items.length === 0) {
      if (guestCart) {
        await this.prisma.cart.delete({ where: { id: guestCart.id } }).catch(() => undefined);
      }
      return this.getCart(userId);
    }

    // Never merge a cart that already belongs to another user
    if (guestCart.userId && guestCart.userId !== userId) {
      return this.getCart(userId);
    }

    const userCart = await this.resolveCart(userId);

    await this.prisma.$transaction(async (tx) => {
      for (const item of guestCart.items) {
        const product = item.product;
        if (!product || !product.active) continue;
        const available = product.inventory
          ? product.inventory.qtyOnHand - product.inventory.qtyReserved
          : 0;
        if (available <= 0) continue;

        const existing = await tx.cartItem.findUnique({
          where: { cartId_productId: { cartId: userCart.id, productId: item.productId } },
        });
        const desired = (existing?.qty || 0) + item.qty;
        const qty = Math.min(desired, available);
        if (qty <= 0) continue;

        if (existing) {
          await tx.cartItem.update({ where: { id: existing.id }, data: { qty } });
        } else {
          await tx.cartItem.create({
            data: { cartId: userCart.id, productId: item.productId, qty },
          });
        }
      }

      await tx.cartItem.deleteMany({ where: { cartId: guestCart.id } });
      await tx.cart.delete({ where: { id: guestCart.id } });
    });

    return this.getCart(userId);
  }
}
