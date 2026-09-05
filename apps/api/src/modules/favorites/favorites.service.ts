import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const favs = await this.prisma.favorite.findMany({
      where: { userId },
      include: {
        product: {
          include: {
            images: { orderBy: { position: 'asc' }, take: 1 },
            inventory: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return favs.map((f) => ({
      id: f.id,
      productId: f.productId,
      createdAt: f.createdAt,
      product: f.product,
    }));
  }

  async add(userId: string, productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || !product.active) throw new NotFoundException('Produto não encontrado');

    const exists = await this.prisma.favorite.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (exists) throw new ConflictException('Produto já está nos favoritos');

    return this.prisma.favorite.create({
      data: { userId, productId },
    });
  }

  async remove(userId: string, productId: string) {
    const exists = await this.prisma.favorite.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (!exists) throw new NotFoundException('Favorito não encontrado');
    await this.prisma.favorite.delete({ where: { id: exists.id } });
    return { deleted: true };
  }
}
