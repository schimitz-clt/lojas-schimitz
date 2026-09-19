import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ok } from '../../common/http';
import { SellerPortalService } from './seller-portal.service';
import { MpOAuthService } from '../marketplace-mp/mp-oauth.service';

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

export class SellerMpCallbackDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  state!: string;
}

@Controller('seller')
@UseGuards(JwtAuthGuard)
export class SellerPortalController {
  constructor(
    private readonly portal: SellerPortalService,
    private readonly mpOAuth: MpOAuthService,
  ) {}

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

  @Get('mp')
  async mpStatus(@CurrentUser('sub') userId: string) {
    return ok(await this.mpOAuth.statusForUser(userId));
  }

  @Get('mp/connect')
  async mpConnect(@CurrentUser('sub') userId: string) {
    return ok(await this.mpOAuth.startConnect(userId));
  }

  @Post('mp/callback')
  async mpCallback(@CurrentUser('sub') userId: string, @Body() dto: SellerMpCallbackDto) {
    return ok(await this.mpOAuth.completeCallback(userId, dto));
  }
}
