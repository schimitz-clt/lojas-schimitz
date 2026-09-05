import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma.service';
import { ok } from '../../common/http';
import { OrdersService } from '../orders/orders.service';
import { AdminUpdateOrderStatusDto } from '../orders/dto';
import { AdminProductsService } from './admin-products.service';
import { AdminCreateProductDto, AdminUpdateProductDto } from './dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OrdersService) private readonly orders: OrdersService,
    private readonly productsService: AdminProductsService,
  ) {}

  @Get('orders')
  async ordersList() {
    const data = await this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { items: true, payments: true },
    });
    return ok(data);
  }

  @Patch('orders/:id/status')
  async updateOrderStatus(
    @CurrentUser('sub') adminId: string,
    @Param('id') id: string,
    @Body() dto: AdminUpdateOrderStatusDto,
  ) {
    return ok(await this.orders.adminUpdateFulfillmentStatus(adminId, id, dto.status));
  }

  @Get('products')
  async products() {
    return ok(await this.productsService.list());
  }

  @Post('products')
  async createProduct(@Body() dto: AdminCreateProductDto) {
    return ok(await this.productsService.create(dto));
  }

  @Patch('products/:id')
  async updateProduct(@Param('id') id: string, @Body() dto: AdminUpdateProductDto) {
    return ok(await this.productsService.update(id, dto));
  }

  @Get('categories')
  async categories() {
    const data = await this.prisma.category.findMany({
      where: { active: true },
      orderBy: { sort: 'asc' },
    });
    return ok(data);
  }
}
