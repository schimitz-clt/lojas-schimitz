import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma.service';
import { ok } from '../../common/http';
import { serializePublicProduct, serializePublicProducts } from './product.serialize';
import {
  buildProductOrderBy,
  buildProductWhere,
  catalogListWindow,
  parseSort,
} from './catalog.query';
import { isPublicSellerVisible, publicSellerShape } from '../sellers/sellers.constants';
import { demoProductWhere, sellableProductWhere } from './demo-product';

/** Soft-merged duplicate slugs → canonical active product (never invent SKUs). */
const PRODUCT_SLUG_ALIASES: Record<string, string> = {
  'ar-condicionado-aiwa': 'ar-condicionado-aiwa-2',
};

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
    @Query('seller') seller?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '24',
    @Query('sellable') sellable?: string,
  ) {
    const listWindow = catalogListWindow(page, pageSize);
    const take = listWindow.pageSize;
    const pageNum = listWindow.page;
    const skip = listWindow.skip;
    const sortKey = parseSort(sort);
    const baseWhere = buildProductWhere({ q, category, minPrice, maxPrice, seller });
    const sellableOnly = sellable === '1' || sellable === 'true';
    const where = sellableOnly ? sellableProductWhere(baseWhere) : baseWhere;
    const orderBy = buildProductOrderBy(sortKey);

    // total = catálogo de navegação (active, inclui DEMO). sellableTotal = active && !isDemo.
    const [data, total, sellableTotal, demoTotal] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        // List cards need primary image + stock + seller — avoid over-fetching description/dims/all images.
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          compareAtPrice: true,
          badge: true,
          isDemo: true,
          ratingAvg: true,
          ratingCount: true,
          active: true,
          createdAt: true,
          updatedAt: true,
          images: { orderBy: { position: 'asc' }, take: 1, select: { url: true, position: true, alt: true } },
          inventory: { select: { qtyOnHand: true, qtyReserved: true } },
          category: { select: { id: true, name: true, slug: true } },
          seller: { select: { id: true, name: true, slug: true } },
        },
        orderBy,
        skip,
        take,
      }),
      this.prisma.product.count({ where }),
      this.prisma.product.count({ where: sellableProductWhere(where) }),
      this.prisma.product.count({ where: demoProductWhere(where) }),
    ]);
    return ok({
      items: serializePublicProducts(data),
      total,
      sellableTotal,
      demoTotal,
      page: pageNum,
      pageSize: take,
      sort: sortKey,
    });
  }

  @Get('products/:slug')
  @ApiOperation({ summary: 'Detalhe do produto por slug' })
  async product(@Param('slug') slug: string) {
    const include = {
      images: { orderBy: { position: 'asc' as const } },
      inventory: true,
      category: true,
      seller: { select: { id: true, name: true, slug: true, status: true } },
    };
    let data = await this.prisma.product.findUnique({ where: { slug }, include });
    if ((!data || !data.active) && PRODUCT_SLUG_ALIASES[slug]) {
      data = await this.prisma.product.findUnique({
        where: { slug: PRODUCT_SLUG_ALIASES[slug] },
        include,
      });
    }
    if (!data || !data.active) throw new NotFoundException('Produto não encontrado');
    if (!isPublicSellerVisible(data.seller?.status)) {
      throw new NotFoundException('Produto não encontrado');
    }
    return ok(
      serializePublicProduct({
        ...data,
        seller: publicSellerShape(data.seller),
      }),
    );
  }
}
