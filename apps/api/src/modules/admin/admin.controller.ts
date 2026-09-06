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
import { AdminUsersService } from './admin-users.service';
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
  AdminUpdateStoreSettingsDto,
  AdminCreateBannerDto,
  AdminUpdateBannerDto,
  AdminReorderBannersDto,
  AdminCreateAdminDto,
  AdminUpdateAdminStatusDto,
  AdminCreateSellerDto,
  AdminUpdateSellerStatusDto,
  AdminUpdateSellerOwnerDto,
} from './dto';
import { CouponsService } from '../coupons/coupons.service';
import { ShippingService } from '../shipping/shipping.service';
import { ReviewsService } from '../reviews/reviews.service';
import { AdminUpdateReviewStatusDto } from '../reviews/dto';
import {
  UPLOAD_ALLOWED_MIME,
  UPLOAD_MAX_BYTES,
  UploadsService,
} from '../uploads/uploads.service';
import { StorefrontService } from '../storefront/storefront.service';
import { SellersService } from '../sellers/sellers.service';
import { CommissionsService } from '../commissions/commissions.service';

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
    private readonly reviews: ReviewsService,
    private readonly storefront: StorefrontService,
    private readonly adminUsers: AdminUsersService,
    private readonly sellers: SellersService,
    private readonly commissions: CommissionsService,
  ) {}


  @Get('admins')
  async listAdmins() {
    return ok(await this.adminUsers.listAdmins());
  }

  @Post('admins')
  async createAdmin(@CurrentUser('sub') actorId: string, @Body() dto: AdminCreateAdminDto) {
    return ok(await this.adminUsers.createAdmin(actorId, dto));
  }

  @Patch('admins/:id/status')
  async updateAdminStatus(
    @CurrentUser('sub') actorId: string,
    @Param('id') id: string,
    @Body() dto: AdminUpdateAdminStatusDto,
  ) {
    return ok(await this.adminUsers.setStatus(actorId, id, dto.status));
  }

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
        user: { select: { id: true, name: true, email: true, phone: true } },
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
    return ok(
      await this.orders.adminUpdateFulfillmentStatus(adminId, id, dto.status, {
        trackingCode: dto.trackingCode,
        carrier: dto.carrier,
      }),
    );
  }

  @Get('sellers')
  async listSellers() {
    return ok(await this.sellers.list());
  }

  @Post('sellers')
  async createSeller(@Body() dto: AdminCreateSellerDto) {
    return ok(await this.sellers.create(dto));
  }

  @Patch('sellers/:id/status')
  async updateSellerStatus(@Param('id') id: string, @Body() dto: AdminUpdateSellerStatusDto) {
    return ok(await this.sellers.setStatus(id, dto.status));
  }

  @Patch('sellers/:id')
  async updateSellerOwner(@Param('id') id: string, @Body() dto: AdminUpdateSellerOwnerDto) {
    return ok(
      await this.sellers.setOwner(id, {
        ownerUserId: dto.ownerUserId,
        ownerEmail: dto.ownerEmail,
        commissionPercent: dto.commissionPercent,
      }),
    );
  }

  @Get('commissions')
  async listCommissions(@Query('status') status?: string) {
    // v1: pending only (read-only stub)
    if (status && status !== 'pending') {
      throw new BadRequestException('Somente status=pending nesta versão');
    }
    return ok(await this.commissions.listPending());
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

  @Get('reviews')
  async reviewsList() {
    return ok(await this.reviews.adminList());
  }

  @Patch('reviews/:id')
  async updateReviewStatus(@Param('id') id: string, @Body() dto: AdminUpdateReviewStatusDto) {
    return ok(await this.reviews.adminSetStatus(id, dto.status));
  }

  @Delete('reviews/:id')
  async deleteReview(@Param('id') id: string) {
    return ok(await this.reviews.adminDelete(id));
  }

  @Get('store/settings')
  async storeSettings() {
    return ok(await this.storefront.getAdminSettings());
  }

  @Patch('store/settings')
  async updateStoreSettings(@Body() dto: AdminUpdateStoreSettingsDto) {
    return ok(await this.storefront.updateSettings(dto));
  }

  @Get('banners')
  async bannersList() {
    return ok(await this.storefront.listAdminBanners());
  }

  @Post('banners')
  async createBanner(@Body() dto: AdminCreateBannerDto) {
    return ok(await this.storefront.createBanner(dto));
  }

  @Patch('banners/reorder')
  async reorderBanners(@Body() dto: AdminReorderBannersDto) {
    return ok(await this.storefront.reorderBanners(dto.orderedIds));
  }

  @Patch('banners/:id')
  async updateBanner(@Param('id') id: string, @Body() dto: AdminUpdateBannerDto) {
    return ok(await this.storefront.updateBanner(id, dto));
  }

  @Delete('banners/:id')
  async deleteBanner(@Param('id') id: string) {
    return ok(await this.storefront.deleteBanner(id));
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
