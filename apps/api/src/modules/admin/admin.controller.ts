import { Body, Controller, Get, Inject, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma.service';
import { ok } from '../../common/http';
import { OrdersService } from '../orders/orders.service';
import { AdminUpdateOrderStatusDto } from '../orders/dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OrdersService) private readonly orders: OrdersService,
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
    const data = await this.prisma.product.findMany({
      include: { inventory: true, images: true },
      orderBy: { createdAt: 'desc' },
    });
    return ok(data);
  }
}
