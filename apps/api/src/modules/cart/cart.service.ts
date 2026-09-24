import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { randomUUID } from 'crypto';
import { AddCartItemDto, UpdateCartItemDto } from './dto';
import { rewritePublicUploadUrl } from '../../common/public-upload-url';
import { availableQty } from '../inventory/inventory.math';
import { isMixedSellerCart } from '../marketplace-mp/mixed-cart';
import { publicSellerShape } from '../sellers/sellers.constants';
import { CouponsService } from '../coupons/coupons.service';
import { evaluateCoupon, isPermanentCouponFailure } from '../coupons/coupon-evaluate';
import { isPixPromoCollidingCouponCode, normalizeCouponCode, roundMoney } from '../../common/pricing';
import { demoPurchaseRejection } from '../catalog/demo-product';

@Injectable()
export class CartService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CouponsService) private readonly coupons: CouponsService,
  ) {}

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
              seller: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      },
    };
  }

  private mapItems(cart: Awaited<ReturnType<typeof this.resolveCart>>) {
    return cart.items.map((item) => {
      const price = Number(item.product.price);
      return {
        id: item.id,
        productId: item.productId,
        qty: item.qty,
        name: item.product.name,
        slug: item.product.slug,
        price,
        image: rewritePublicUploadUrl(item.product.images[0]?.url ?? null),
        stock: item.product.inventory
          ? availableQty(item.product.inventory.qtyOnHand, item.product.inventory.qtyReserved)
          : 0,
        lineTotal: price * item.qty,
        weightKg: item.product.weightKg == null ? null : Number(item.product.weightKg),
        widthCm: item.product.widthCm == null ? null : Number(item.product.widthCm),
        heightCm: item.product.heightCm == null ? null : Number(item.product.heightCm),
        lengthCm: item.product.lengthCm == null ? null : Number(item.product.lengthCm),
        isDemo: item.product.isDemo,
        sellerId: item.product.sellerId,
        seller: item.product.seller ? publicSellerShape(item.product.seller) : null,
      };
    });
  }

  private async attachCoupon(
    cartId: string,
    storedCode: string | null | undefined,
    subtotal: number,
  ) {
    const code = normalizeCouponCode(storedCode);
    if (!code) {
      return { coupon: null as null, couponError: null as null, discount: 0 };
    }
    const row = await this.prisma.coupon.findUnique({ where: { code } });
    const evaluated = evaluateCoupon(
      row
        ? {
            code: row.code,
            type: row.type,
            value: Number(row.value),
            active: row.active,
            minSubtotal: row.minSubtotal == null ? null : Number(row.minSubtotal),
            startsAt: row.startsAt,
            endsAt: row.endsAt,
            maxUses: row.maxUses,
            usedCount: row.usedCount,
            reservedCount: row.reservedCount,
          }
        : null,
      subtotal,
    );
    if (!evaluated.ok) {
      if (isPermanentCouponFailure(evaluated.code)) {
        await this.prisma.cart.update({
          where: { id: cartId },
          data: { couponCode: null },
        });
      }
      return {
        coupon: null,
        couponError: { code: evaluated.code, message: evaluated.message },
        discount: 0,
      };
    }
    return {
      coupon: {
        id: row!.id,
        code: row!.code,
        type: row!.type,
        value: Number(row!.value),
        discount: evaluated.discount,
        finalSubtotal: evaluated.finalSubtotal,
        minSubtotal: row!.minSubtotal == null ? null : Number(row!.minSubtotal),
        endsAt: row!.endsAt,
        collidesWithPixPromo: isPixPromoCollidingCouponCode(row!.code),
      },
      couponError: null,
      discount: evaluated.discount,
    };
  }

  private async format(cart: Awaited<ReturnType<typeof this.resolveCart>>) {
    const items = this.mapItems(cart);
    const subtotal = roundMoney(items.reduce((s, i) => s + i.lineTotal, 0));
    const attached = await this.attachCoupon(cart.id, cart.couponCode, subtotal);
    return {
      id: cart.id,
      guestToken: cart.guestToken,
      items,
      subtotal,
      discount: attached.discount,
      total: roundMoney(Math.max(0, subtotal - attached.discount)),
      coupon: attached.coupon,
      couponError: attached.couponError,
      itemCount: items.reduce((s, i) => s + i.qty, 0),
      mixedSellers: isMixedSellerCart(items),
    };
  }

  async getCart(userId?: string, guestToken?: string) {
    const cart = await this.resolveCart(userId, guestToken);
    return this.format(cart);
  }

  async applyCoupon(code: string, userId?: string, guestToken?: string) {
    const cart = await this.resolveCart(userId, guestToken);
    const items = this.mapItems(cart);
    if (items.length === 0) {
      throw new BadRequestException({ message: 'Sacola vazia', code: 'CART_EMPTY' });
    }
    const subtotal = roundMoney(items.reduce((s, i) => s + i.lineTotal, 0));
    const validated = await this.coupons.validate(code, subtotal);
    if (normalizeCouponCode(cart.couponCode) !== validated.code) {
      await this.prisma.cart.update({
        where: { id: cart.id },
        data: { couponCode: validated.code },
      });
    }
    return this.getCart(userId, cart.guestToken ?? guestToken);
  }

  async removeCoupon(userId?: string, guestToken?: string) {
    const cart = await this.resolveCart(userId, guestToken);
    if (cart.couponCode) {
      await this.prisma.cart.update({
        where: { id: cart.id },
        data: { couponCode: null },
      });
    }
    return this.getCart(userId, cart.guestToken ?? guestToken);
  }

  async addItem(dto: AddCartItemDto, userId?: string, guestToken?: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: { inventory: true },
    });
    if (!product || !product.active) throw new NotFoundException('Produto não encontrado');
    const demoBlocked = demoPurchaseRejection(product);
    if (demoBlocked) throw new BadRequestException(demoBlocked);

    const available = product.inventory
      ? availableQty(product.inventory.qtyOnHand, product.inventory.qtyReserved)
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
    const demoBlocked = demoPurchaseRejection(item.product);
    if (demoBlocked) throw new BadRequestException(demoBlocked);

    const available = item.product.inventory
      ? availableQty(item.product.inventory.qtyOnHand, item.product.inventory.qtyReserved)
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
    if (cart.couponCode) {
      await this.prisma.cart.update({
        where: { id: cart.id },
        data: { couponCode: null },
      });
    }
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
      const nextCoupon = guestCart.couponCode || userCart.couponCode || null;
      if (nextCoupon && nextCoupon !== userCart.couponCode) {
        await tx.cart.update({
          where: { id: userCart.id },
          data: { couponCode: nextCoupon },
        });
      }

      for (const item of guestCart.items) {
        const product = item.product;
        if (!product || !product.active || product.isDemo) continue;
        const available = product.inventory
          ? availableQty(product.inventory.qtyOnHand, product.inventory.qtyReserved)
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
