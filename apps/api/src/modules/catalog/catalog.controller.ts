import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma.service';
import { ok } from '../../common/http';
import { serializePublicProduct, serializePublicProducts } from './product.serialize';
import {
  buildProductOrderBy,
  buildProductWhere,
  parsePage,
  parsePageSize,
  parseSort,
} from './catalog.query';

@ApiTags('catalog')
@Controller()
export class CatalogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('categories')
  @ApiOperation({ summary: 'Listar categorias ativas' })
  async categories() {
    const data = await this.prisma.category.findMany({
      where: { active: true },
      orderBy: { sort: 'asc' },
    });
    return ok(data);
  }

  @Get('products')
  @ApiOperation({ summary: 'Listar produtos (filtros q/category/price/sort)' })
  async products(
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('sort') sort?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '24',
  ) {
    const take = parsePageSize(pageSize);
    const pageNum = parsePage(page);
    const skip = (pageNum - 1) * take;
    const sortKey = parseSort(sort);
    const where = buildProductWhere({ q, category, minPrice, maxPrice });
    const orderBy = buildProductOrderBy(sortKey);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: {
          images: { orderBy: { position: 'asc' } },
          inventory: true,
          category: true,
          seller: { select: { id: true, name: true, slug: true } },
        },
        orderBy,
        skip,
        take,
      }),
      this.prisma.product.count({ where }),
    ]);
    return ok({
      items: serializePublicProducts(data),
      total,
      page: pageNum,
      pageSize: take,
      sort: sortKey,
    });
  }

  @Get('products/:slug')
  @ApiOperation({ summary: 'Detalhe do produto por slug' })
  async product(@Param('slug') slug: string) {
    const data = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        images: { orderBy: { position: 'asc' } },
        inventory: true,
        category: true,
        seller: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!data || !data.active) throw new NotFoundException('Produto não encontrado');
    return ok(serializePublicProduct(data));
  }
}
