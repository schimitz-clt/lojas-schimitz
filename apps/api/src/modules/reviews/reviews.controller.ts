import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ok } from '../../common/http';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto';

@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('products/:id/reviews')
  async list(@Param('id') productId: string) {
    return ok(await this.reviews.listByProduct(productId));
  }

  @Get('products/:id/reviews/me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser('sub') userId: string, @Param('id') productId: string) {
    return ok(await this.reviews.eligibility(userId, productId));
  }

  /** Cria ou atualiza (1 por usuário/produto). Exige compra paga+. */
  @Post('products/:id/reviews')
  @UseGuards(JwtAuthGuard)
  async upsert(
    @CurrentUser('sub') userId: string,
    @Param('id') productId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return ok(await this.reviews.upsert(userId, productId, dto));
  }
}
