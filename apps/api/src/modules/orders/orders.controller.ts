import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ok } from '../../common/http';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto';
import { requireIdempotencyKey } from './idempotency';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const key = requireIdempotencyKey(idempotencyKey);
    return ok(await this.orders.create(userId, dto, key));
  }

  @Get()
  async list(@CurrentUser('sub') userId: string) {
    return ok(await this.orders.list(userId));
  }

  @Get(':publicId')
  async get(@CurrentUser('sub') userId: string, @Param('publicId') publicId: string) {
    return ok(await this.orders.getByPublicId(userId, publicId));
  }

  @Post(':publicId/cancel')
  async cancel(@CurrentUser('sub') userId: string, @Param('publicId') publicId: string) {
    return ok(await this.orders.cancel(userId, publicId));
  }
}
