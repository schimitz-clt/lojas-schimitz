import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { ok } from '../../common/http';

@Controller()
export class CatalogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('categories')
  async categories() {
    const data = await this.prisma.category.findMany({
      where: { active: true },
      orderBy: { sort: 'asc' },
    });
    return ok(data);
  }

  @Get('products')
  async products(
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '24',
  ) {
    const take = Math.min(60, Math.max(1, Number(pageSize) || 24));
    const skip = (Math.max(1, Number(page) || 1) - 1) * take;
    const where = {
      active: true,
      ...(category ? { category: { slug: category } } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { sku: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: { images: { orderBy: { position: 'asc' } }, inventory: true, category: true },
        skip,
        take,
      }),
      this.prisma.product.count({ where }),
    ]);
    return ok({ items: data, total, page: Math.max(1, Number(page) || 1), pageSize: take });
  }

  @Get('products/:slug')
  async product(@Param('slug') slug: string) {
    const data = await this.prisma.product.findUnique({
      where: { slug },
      include: { images: { orderBy: { position: 'asc' } }, inventory: true, category: true },
    });
    if (!data || !data.active) throw new NotFoundException('Produto não encontrado');
    return ok(data);
  }
}
