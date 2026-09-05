import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma.service';
import { CreateReviewDto } from './dto';
import {
  REVIEW_ELIGIBLE_STATUSES,
  aggregatePublishedRatings,
} from './reviews.eligibility';

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

  async eligibility(userId: string, productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || !product.active) throw new NotFoundException('Produto não encontrado');

    const hasPurchased = await this.userHasPurchased(userId, productId);
    const myReview = await this.prisma.review.findUnique({
      where: { productId_userId: { productId, userId } },
      include: { user: { select: { id: true, name: true } } },
    });

    return {
      hasPurchased,
      canReview: hasPurchased,
      myReview,
    };
  }

  /**
   * Cria ou atualiza (1 avaliação por usuário/produto).
   * Exige pedido pago+ com o produto.
   */
  async upsert(userId: string, productId: string, dto: CreateReviewDto) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || !product.active) throw new NotFoundException('Produto não encontrado');

    const hasPurchased = await this.userHasPurchased(userId, productId);
    if (!hasPurchased) {
      throw new ForbiddenException(
        'Só quem comprou este produto (pedido pago) pode avaliar',
      );
    }

    const body = (dto.body ?? '').trim();
    const review = await this.prisma.review.upsert({
      where: { productId_userId: { productId, userId } },
      create: {
        productId,
        userId,
        rating: dto.rating,
        body,
        status: 'published',
      },
      update: {
        rating: dto.rating,
        body,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    await this.refreshProductRating(productId);
    return review;
  }

  async adminList(take = 100) {
    return this.prisma.review.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(200, Math.max(1, take)),
      include: {
        user: { select: { id: true, name: true, email: true } },
        product: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  async adminSetStatus(id: string, status: 'published' | 'hidden') {
    const existing = await this.prisma.review.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Avaliação não encontrada');

    const review = await this.prisma.review.update({
      where: { id },
      data: { status },
      include: {
        user: { select: { id: true, name: true, email: true } },
        product: { select: { id: true, name: true, slug: true } },
      },
    });
    await this.refreshProductRating(existing.productId);
    return review;
  }

  async adminDelete(id: string) {
    const existing = await this.prisma.review.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Avaliação não encontrada');
    await this.prisma.review.delete({ where: { id } });
    await this.refreshProductRating(existing.productId);
    return { deleted: true };
  }

  private async userHasPurchased(userId: string, productId: string): Promise<boolean> {
    const item = await this.prisma.orderItem.findFirst({
      where: {
        productId,
        order: {
          userId,
          status: { in: REVIEW_ELIGIBLE_STATUSES },
        },
      },
      select: { id: true },
    });
    return Boolean(item);
  }

  private async refreshProductRating(productId: string) {
    const published = await this.prisma.review.findMany({
      where: { productId, status: 'published' },
      select: { rating: true },
    });
    const { avg, count } = aggregatePublishedRatings(published.map((r) => r.rating));
    await this.prisma.product.update({
      where: { id: productId },
      data: {
        ratingAvg: new Decimal(avg),
        ratingCount: count,
      },
    });
  }
}
