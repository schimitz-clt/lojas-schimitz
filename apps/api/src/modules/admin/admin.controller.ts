import {
  BadRequestException,
  Body,
  Logger,
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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
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
import { AdminCustomersService } from './admin-customers.service';
import {
  AdminCreateCouponDto,
  AdminAddProductImageDto,
  AdminCreateProductDto,
  AdminCreateShippingCepRuleDto,
  AdminOrdersQueryDto,
  AdminProductsQueryDto,
  AdminReorderProductImagesDto,
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
  AdminApproveCommissionDto,
  AdminMarkCommissionPaidDto,
  AdminCustomersQueryDto,
} from './dto';
import { CouponsService } from '../coupons/coupons.service';
import { ShippingService } from '../shipping/shipping.service';
import { ReviewsService } from '../reviews/reviews.service';
import { AdminUpdateReviewStatusDto } from '../reviews/dto';
import {
  UPLOAD_MAX_BYTES,
  UploadsService,
} from '../uploads/uploads.service';
import { validateUpload } from '../uploads/upload-validate';
import { StorefrontService } from '../storefront/storefront.service';
import { SellersService } from '../sellers/sellers.service';
import { CommissionsService } from '../commissions/commissions.service';
import { rewritePublicUploadUrl } from '../../common/public-upload-url';
import { DEFAULT_OPS_LOW_STOCK_THRESHOLD, listPlaceholderProducts, placeholderProductsCsv, OPS_RECONCILIATIONS_RECENT_CAP, PAID_STUCK_HOURS, summarizeOps, summarizePaidAwaitingOrg, summarizeReconciliations, summarizeSalesWindow, summarizeUploadsDurability } from './admin-ops';
import { RECONCILIATION_STATUS_OPEN } from '../payments/reconciliation';
import { PAID_REVENUE_STATUSES, parseSalesDateRange, saoPauloYmd } from './admin-sales-report';
import { isAdminOrderQueueBucket, statusesForAdminQueueBucket } from '../../common/order-status';
import { mailConfiguredFromEnvPresence, storeNotifyConfiguredFromEnvPresence } from '../mail/mail.config';
import { peekStoreNotifyMailSnapshot } from '../notifications/store-notify-obs';
import {
  buildAdminOrderWhere,
  resolveAdminOrdersTake,
} from './admin-orders-search';

@ApiTags('admin')
@ApiBearerAuth('access-token')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  private readonly log = new Logger(AdminController.name);

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
    private readonly adminCustomers: AdminCustomersService,
  ) {}



  @Get('ops')
  @ApiOperation({
    summary:
      'Centro de comando: estoque, placeholders, pagamentos, reconciliações, filas, vendas (DB) e alertas reais',
  })
  async ops() {
    const threshold = DEFAULT_OPS_LOW_STOCK_THRESHOLD;
    const todayYmd = saoPauloYmd(new Date());
    const todayRange = parseSalesDateRange(todayYmd, todayYmd);
    const last30 = parseSalesDateRange(undefined, todayYmd); // default last 30d inclusive
    const paidStatuses = [...PAID_REVENUE_STATUSES] as OrderStatus[];

    const [
      lowStockCount,
      outOfStockCount,
      pendingPaymentCount,
      productImageRows,
      orderStatusGroups,
      salesTodayAgg,
      salesLast30Agg,
    ] = await Promise.all([
      this.prisma.inventory.count({ where: { qtyOnHand: { lte: threshold } } }),
      this.prisma.inventory.count({ where: { qtyOnHand: { lte: 0 } } }),
      this.prisma.payment.count({ where: { status: 'pending' } }),
      this.prisma.product.findMany({
        select: {
          id: true,
          name: true,
          images: { orderBy: { position: 'asc' }, take: 1, select: { url: true } },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.order.aggregate({
        where: {
          status: { in: paidStatuses },
          createdAt: { gte: todayRange.fromDate, lt: todayRange.toDateExclusive },
        },
        _count: { _all: true },
        _sum: { total: true },
      }),
      this.prisma.order.aggregate({
        where: {
          status: { in: paidStatuses },
          createdAt: { gte: last30.fromDate, lt: last30.toDateExclusive },
        },
        _count: { _all: true },
        _sum: { total: true },
      }),
    ]);

    // Reconciliation summary — additive; degrade safely if table/model unavailable.
    let reconciliations = summarizeReconciliations({ openCount: 0, recent: [] });
    try {
      const reconWhere = {
        status: RECONCILIATION_STATUS_OPEN,
        resolvedAt: null,
      } as const;
      const [openCount, recentRows] = await Promise.all([
        this.prisma.paymentReconciliation.count({ where: reconWhere }),
        this.prisma.paymentReconciliation.findMany({
          where: reconWhere,
          orderBy: { createdAt: 'desc' },
          take: OPS_RECONCILIATIONS_RECENT_CAP,
          select: {
            id: true,
            reason: true,
            providerStatus: true,
            externalReference: true,
            createdAt: true,
            status: true,
          },
        }),
      ]);
      reconciliations = summarizeReconciliations({
        openCount,
        recent: recentRows,
      });
    } catch {
      reconciliations = summarizeReconciliations({ openCount: 0, recent: [] });
    }

    // Paid awaiting organization + stuck age (PAID_STUCK_HOURS) — real DB only.
    let paidAwaitingOrg = summarizePaidAwaitingOrg({ orders: [] });
    try {
      const paidRows = await this.prisma.order.findMany({
        where: { status: 'paid' },
        select: {
          id: true,
          publicId: true,
          createdAt: true,
          updatedAt: true,
          statusHistory: {
            where: { toStatus: 'paid' },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { createdAt: true },
          },
        },
        orderBy: { createdAt: 'asc' },
        take: 200,
      });
      paidAwaitingOrg = summarizePaidAwaitingOrg({
        orders: paidRows.map((o) => ({
          id: o.id,
          publicId: o.publicId,
          since: o.statusHistory[0]?.createdAt ?? o.createdAt,
        })),
        thresholdHours: PAID_STUCK_HOURS,
      });
      if (paidAwaitingOrg.stuckCount > 0) {
        this.log.warn(
          `ops paid_stuck_awaiting_org count=${paidAwaitingOrg.stuckCount} thresholdHours=${PAID_STUCK_HOURS} ids=${paidAwaitingOrg.stuckPublicIds.join(',') || '(none)'} mailConfigured=${mailConfiguredFromEnvPresence()} — STORE_NOTIFY: Separar (Organizando)`,
        );
      }
    } catch (e: any) {
      this.log.warn(`ops paidAwaitingOrg query failed: ${e?.message || e}`);
      paidAwaitingOrg = summarizePaidAwaitingOrg({ orders: [] });
    }

    const placeholderProducts = listPlaceholderProducts(productImageRows);
    const orderStatusCounts = orderStatusGroups.map((g) => ({
      status: g.status,
      count: g._count._all,
    }));
    const uploads = summarizeUploadsDurability({
      envDir: process.env.UPLOADS_DIR,
    });
    if (!uploads.persistent) {
      this.log.warn(
        `ops uploads_ephemeral dir=${uploads.dir} — mount Volume /data/uploads (OWNER); UPLOADS_DIR should be under /data`,
      );
    }
    return ok(
      summarizeOps({
        lowStockCount,
        outOfStockCount,
        placeholderProductCount: placeholderProducts.length,
        placeholderProducts,
        pendingPaymentCount,
        threshold,
        mailConfigured: mailConfiguredFromEnvPresence(),
        storeNotifyConfigured: storeNotifyConfiguredFromEnvPresence(),
        orderStatusCounts,
        salesToday: summarizeSalesWindow({
          from: todayRange.from,
          to: todayRange.to,
          orderCount: salesTodayAgg._count._all,
          revenue: Number(salesTodayAgg._sum.total ?? 0),
        }),
        salesLast30d: summarizeSalesWindow({
          from: last30.from,
          to: last30.to,
          orderCount: salesLast30Agg._count._all,
          revenue: Number(salesLast30Agg._sum.total ?? 0),
        }),
        reconciliations,
        paidAwaitingOrg,
        uploads,
        storeNotifyMail: peekStoreNotifyMailSnapshot(),
      }),
    );
  }


  @Get('ops/products-needing-photos')
  @ApiOperation({
    summary:
      'CSV export (id,name,imageUrl) of products with missing/placeholder photos — no fake images',
  })
  async productsNeedingPhotosCsv() {
    const productImageRows = await this.prisma.product.findMany({
      select: {
        id: true,
        name: true,
        images: { orderBy: { position: 'asc' }, take: 1, select: { url: true } },
      },
      orderBy: { name: 'asc' },
    });
    const rows = listPlaceholderProducts(productImageRows);
    return ok(placeholderProductsCsv(rows));
  }

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

  @Get('customers')
  @ApiOperation({
    summary:
      'Listar clientes (CRM read-only): busca nome/e-mail/telefone + pedidos, total pago, último pedido, cidade',
  })
  async listCustomers(@Query() query: AdminCustomersQueryDto) {
    return ok(await this.adminCustomers.list(query));
  }

  @Get('customers/:id')
  @ApiOperation({
    summary:
      'Detalhe do cliente + endereços + até 50 pedidos (publicId, status, totais, data, pagamento) — sem passwordHash',
  })
  async getCustomer(@Param('id') id: string) {
    return ok(await this.adminCustomers.getById(id));
  }

  @Get('reports/sales')
  async getSalesReport(@Query() query: AdminSalesReportQueryDto) {
    return ok(await this.salesReports.salesReport(query));
  }

  @Get('orders')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Listar pedidos (take 100) ou busca autenticada ?q= (publicId/email/nome, take≤50)',
  })
  async ordersList(@Query() query: AdminOrdersQueryDto) {
    let statusWhere: { status?: OrderStatus | { in: OrderStatus[] } } | undefined;
    if (query.status) {
      if (query.status === 'problems' || isAdminOrderQueueBucket(query.status)) {
        const statuses = statusesForAdminQueueBucket(query.status) as OrderStatus[];
        statusWhere =
          statuses.length === 1
            ? { status: statuses[0] }
            : { status: { in: statuses } };
      } else {
        statusWhere = { status: query.status as OrderStatus };
      }
    }
    const where = buildAdminOrderWhere(query.q, statusWhere);
    const take = resolveAdminOrdersTake(query.q, query.take);
    const data = await this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        items: true,
        payments: true,
        user: { select: { id: true, name: true, email: true, phone: true } },
        statusHistory: {
          orderBy: { createdAt: 'asc' },
          take: 40,
          select: {
            id: true,
            fromStatus: true,
            toStatus: true,
            note: true,
            createdAt: true,
            actorId: true,
          },
        },
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

  @Post('orders/:id/notify-paid')
  @ApiOperation({
    summary: 'Reenvia e-mail/in-app de venda paga para a loja (pedido já pago). Sem cobrança.',
  })
  async resendStorePaidNotify(@Param('id') id: string) {
    return ok(await this.orders.adminResendStorePaidNotify(id));
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
  async listCommissions(
    @Query('status') status?: string,
    @Query('sellerId') sellerId?: string,
    @Query('limit') limit?: string,
  ) {
    const lim = limit != null && limit !== '' ? Number(limit) : undefined;
    return ok(
      await this.commissions.list({
        status: status || 'pending',
        sellerId: sellerId || undefined,
        limit: Number.isFinite(lim) ? lim : undefined,
      }),
    );
  }

  @Get('commissions/export')
  async exportCommissions(
    @Query('sellerId') sellerId?: string,
    @Query('status') status?: string,
  ) {
    if (!sellerId) {
      throw new BadRequestException('sellerId é obrigatório');
    }
    return ok(
      await this.commissions.exportCsv({
        sellerId,
        status: status || 'pending',
      }),
    );
  }

  @Patch('commissions/:id/approve')
  async approveCommission(
    @Param('id') id: string,
    @Body() dto: AdminApproveCommissionDto,
  ) {
    return ok(await this.commissions.approve(id, dto?.note));
  }

  @Patch('commissions/:id/paid')
  async markCommissionPaid(
    @Param('id') id: string,
    @Body() dto: AdminMarkCommissionPaidDto,
  ) {
    return ok(
      await this.commissions.markPaid(id, {
        payoutReference: dto?.payoutReference,
        note: dto?.note,
      }),
    );
  }

  @Get('products')
  async products(@Query() query: AdminProductsQueryDto) {
    return ok(await this.productsService.list({ lowStock: query.lowStock }));
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'Produto admin com todas as fotos da galeria' })
  async product(@Param('id') id: string) {
    return ok(await this.productsService.get(id));
  }

  @Post('products')
  async createProduct(@Body() dto: AdminCreateProductDto) {
    return ok(await this.productsService.create(dto));
  }

  @Patch('products/:id')
  async updateProduct(@Param('id') id: string, @Body() dto: AdminUpdateProductDto) {
    return ok(await this.productsService.update(id, dto));
  }

  @Post('products/:id/images')
  @ApiOperation({ summary: 'Adiciona foto ao produto (após /admin/uploads)' })
  async addProductImage(@Param('id') id: string, @Body() dto: AdminAddProductImageDto) {
    return ok(await this.productsService.addImage(id, dto));
  }

  @Patch('products/:id/images/reorder')
  @ApiOperation({ summary: 'Reordena fotos (índice 0 = capa)' })
  async reorderProductImages(
    @Param('id') id: string,
    @Body() dto: AdminReorderProductImagesDto,
  ) {
    return ok(await this.productsService.reorderImages(id, dto.orderedIds));
  }

  @Delete('products/:id/images/:imageId')
  @ApiOperation({ summary: 'Remove uma foto do produto' })
  async deleteProductImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ) {
    return ok(await this.productsService.deleteImage(id, imageId));
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
   * Campo: `file` — jpg/png/webp (magic-bytes), máx. 15 MB.
   * Retorna `{ url }` absoluta (apex se SITE_URL/APP_URL) em GET /api/v1/uploads/:filename
   */
  @Post('uploads')
  @Throttle({ default: { limit: 40, ttl: 60000 } })
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
      throw new BadRequestException({
        message: 'Envie um arquivo no campo "file" (JPG, PNG ou WebP, até 15 MB).',
        code: 'UPLOAD_EMPTY',
      });
    }
    const checked = validateUpload({
      buffer: file.buffer,
      mimetype: file.mimetype,
      size: file.size,
    });
    if (!checked.ok) {
      throw new BadRequestException({ message: checked.message, code: checked.code });
    }
    const { filename } = this.uploads.save(file.buffer, checked.mime);
    const rawUrl = this.uploads.publicUrl(filename, req);
    const url = rewritePublicUploadUrl(rawUrl) || rawUrl;
    return ok({ url, filename });
  }
}
