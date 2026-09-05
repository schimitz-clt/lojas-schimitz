import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
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
import { PrismaService } from '../../prisma.service';
import { ok } from '../../common/http';
import { OrdersService } from '../orders/orders.service';
import { AdminUpdateOrderStatusDto } from '../orders/dto';
import { AdminProductsService } from './admin-products.service';
import { AdminCreateProductDto, AdminUpdateProductDto } from './dto';
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
