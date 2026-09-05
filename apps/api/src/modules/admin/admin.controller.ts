import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../prisma.service';
import { ok } from '../../common/http';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('orders')
  async orders() {
    const data = await this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { items: true, payments: true },
    });
    return ok(data);
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
