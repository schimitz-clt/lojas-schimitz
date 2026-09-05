import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { ok } from '../../common/http';
import { OrdersService } from '../orders/orders.service';
import { AdminUpdateOrderStatusDto } from '../orders/dto';
import { AdminProductsService } from './admin-products.service';
import { AdminSalesReportService } from './admin-sales-report.service';
import {
  AdminCreateCouponDto,
  AdminCreateProductDto,
  AdminCreateShippingCepRuleDto,
  AdminOrdersQueryDto,
  AdminProductsQueryDto,
  AdminUpdateCouponDto,
  AdminUpdateProductDto,
  AdminUpdateShippingCepRuleDto,
  AdminSalesReportQueryDto,
  AdminUpdateShippingSettingsDto,
} from './dto';
import { CouponsService } from '../coupons/coupons.service';
import { ShippingService } from '../shipping/shipping.service';
import {
  UPLOAD_ALLOWED_MIME,
  UPLOAD_MAX_BYTES,
  UploadsService,
} from '../uploads/uploads.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OrdersService) private readonly orders: OrdersService,
    private readonly productsService: AdminProductsService,
    private readonly uploads: UploadsService,
    private readonly coupons: CouponsService,
    private readonly shipping: ShippingService,
    private readonly salesReports: AdminSalesReportService,
  ) {}

  @Get('reports/sales')
  async getSalesReport(@Query() query: AdminSalesReportQueryDto) {
    return ok(await this.salesReports.salesReport(query));
  }

  @Get('orders')
  async ordersList(@Query() query: AdminOrdersQueryDto) {
    const data = await this.prisma.order.findMany({
      where: query.status ? { status: query.status as OrderStatus } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        items: true,
        payments: true,
        user: { select: { id: true, name: true, email: true } },
      },
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
  async products(@Query() query: AdminProductsQueryDto) {
    return ok(await this.productsService.list({ lowStock: query.lowStock }));
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


  @Get('coupons')
  async couponsList() {
    return ok(await this.coupons.listAdmin());
  }

  @Post('coupons')
  async createCoupon(@Body() dto: AdminCreateCouponDto) {
    return ok(await this.coupons.createAdmin(dto));
  }

  @Patch('coupons/:id')
  async updateCoupon(@Param('id') id: string, @Body() dto: AdminUpdateCouponDto) {
    return ok(await this.coupons.updateAdmin(id, dto));
  }


  @Get('shipping')
  async shippingConfig() {
    return ok(await this.shipping.getAdminConfig());
  }

  @Patch('shipping/settings')
  async updateShippingSettings(@Body() dto: AdminUpdateShippingSettingsDto) {
    return ok(await this.shipping.updateSettings(dto));
  }

  @Post('shipping/rules')
  async createShippingRule(@Body() dto: AdminCreateShippingCepRuleDto) {
    return ok(await this.shipping.createRule(dto));
  }

  @Patch('shipping/rules/:id')
  async updateShippingRule(@Param('id') id: string, @Body() dto: AdminUpdateShippingCepRuleDto) {
    return ok(await this.shipping.updateRule(id, dto));
  }

  @Delete('shipping/rules/:id')
  async deleteShippingRule(@Param('id') id: string) {
    return ok(await this.shipping.deleteRule(id));
  }

  /**
   * Multipart upload de imagem de produto (admin).
   * Campo: `file` — jpg/png/webp, máx. 15 MB.
   * Retorna `{ url }` absoluta servida em GET /api/v1/uploads/:filename
   */
  @Post('uploads')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: UPLOAD_MAX_BYTES, files: 1 },
    }),
  )
  async uploadProductImage(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Envie um arquivo no campo "file"');
    }
    if (!UPLOAD_ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException('Tipo inválido. Use JPG, PNG ou WebP.');
    }
    if (file.size > UPLOAD_MAX_BYTES) {
      throw new BadRequestException('Arquivo maior que 15 MB');
    }
    const { filename } = this.uploads.save(file.buffer, file.mimetype);
    const url = this.uploads.publicUrl(filename, req);
    return ok({ url, filename });
  }
}
