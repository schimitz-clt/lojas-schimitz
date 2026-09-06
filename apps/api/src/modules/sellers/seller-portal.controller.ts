import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { IsInt, IsNumber, IsOptional, Min, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ok } from '../../common/http';
import { SellerPortalService } from './seller-portal.service';

export class SellerUpdateProductDto {
  @IsOptional()
  @Type(() => Number)
  @ValidateIf((_, v) => v != null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;

  @IsOptional()
  @Type(() => Number)
  @ValidateIf((_, v) => v != null)
  @IsInt()
  @Min(0)
  stock?: number;
}

@Controller('seller')
@UseGuards(JwtAuthGuard)
export class SellerPortalController {
  constructor(private readonly portal: SellerPortalService) {}

  @Get('me')
  async me(@CurrentUser('sub') userId: string) {
    return ok(await this.portal.me(userId));
  }

  @Get('products')
  async products(@CurrentUser('sub') userId: string) {
    return ok(await this.portal.listProducts(userId));
  }

  @Patch('products/:id')
  async updateProduct(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: SellerUpdateProductDto,
  ) {
    return ok(await this.portal.updateProduct(userId, id, dto));
  }

  @Get('orders')
  async orders(@CurrentUser('sub') userId: string) {
    return ok(await this.portal.listOrders(userId));
  }

  @Get('commissions')
  async commissions(@CurrentUser('sub') userId: string) {
    return ok(await this.portal.listCommissions(userId));
  }
}
