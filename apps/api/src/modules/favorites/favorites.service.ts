import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { canAddToWishlist } from './favorites.rules';
import { serializeFavoriteItems } from './favorites.serialize';

const productInclude = {
  images: { orderBy: { position: 'asc' as const }, take: 1 },
  inventory: true,
  category: { select: { id: true, name: true, slug: true } },
  seller: { select: { id: true, name: true, slug: true, status: true } },
};

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const favs = await this.prisma.favorite.findMany({
      where: {
        userId,
        product: { active: true, seller: { status: 'active' } },
      },
      include: { product: { include: productInclude } },
      orderBy: { createdAt: 'desc' },
    });
    return serializeFavoriteItems(favs);
  }

  async add(userId: string, productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { seller: { select: { status: true } } },
    });
    if (!canAddToWishlist(product)) throw new NotFoundException('Produto não encontrado');

    return this.prisma.favorite.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId },
      update: {},
    });
  }

  async remove(userId: string, productId: string) {
    await this.prisma.favorite.deleteMany({ where: { userId, productId } });
    return { deleted: true };
  }
}
