import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ok } from '../../common/http';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FavoritesService } from './favorites.service';
import { IsUUID } from 'class-validator';

class AddFavoriteDto {
  @IsUUID()
  productId!: string;
}

@Controller('favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  async list(@CurrentUser('sub') userId: string) {
    return ok(await this.favorites.list(userId));
  }

  @Post()
  async add(@CurrentUser('sub') userId: string, @Body() dto: AddFavoriteDto) {
    return ok(await this.favorites.add(userId, dto.productId));
  }

  @Delete(':productId')
  async remove(@CurrentUser('sub') userId: string, @Param('productId') productId: string) {
    return ok(await this.favorites.remove(userId, productId));
  }
}
