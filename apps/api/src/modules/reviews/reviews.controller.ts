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

  @Post('products/:id/reviews')
  @UseGuards(JwtAuthGuard)
  async create(
    @CurrentUser('sub') userId: string,
    @Param('id') productId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return ok(await this.reviews.create(userId, productId, dto));
  }
}
