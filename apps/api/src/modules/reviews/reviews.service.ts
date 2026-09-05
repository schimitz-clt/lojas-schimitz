import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateReviewDto } from './dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async listByProduct(productId: string) {
    return this.prisma.review.findMany({
      where: { productId, status: 'published' },
      include: {
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, productId: string, dto: CreateReviewDto) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || !product.active) throw new NotFoundException('Produto não encontrado');

    const exists = await this.prisma.review.findUnique({
      where: { productId_userId: { productId, userId } },
    });
    if (exists) throw new ConflictException('Você já avaliou este produto');

    const review = await this.prisma.review.create({
      data: {
        productId,
        userId,
        rating: dto.rating,
        body: dto.body ?? '',
      },
    });

    // atualiza média
    const agg = await this.prisma.review.aggregate({
      where: { productId, status: 'published' },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await this.prisma.product.update({
      where: { id: productId },
      data: {
        ratingAvg: new Decimal(agg._avg.rating ?? 0),
        ratingCount: agg._count.rating,
      },
    });

    return review;
  }
}
