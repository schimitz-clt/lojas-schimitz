import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { ok } from '../../common/http';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FavoritesService } from './favorites.service';

class AddFavoriteDto {
  @IsUUID()
  productId!: string;
}

@ApiTags('favorites')
@ApiBearerAuth('access-token')
@Controller('favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar lista de desejos (Salvos) — produtos reais do catálogo' })
  async list(@CurrentUser('sub') userId: string) {
    return ok(await this.favorites.list(userId));
  }

  @Post()
  @ApiOperation({ summary: 'Salvar produto na lista de desejos (idempotente)' })
  async add(@CurrentUser('sub') userId: string, @Body() dto: AddFavoriteDto) {
    return ok(await this.favorites.add(userId, dto.productId));
  }

  @Delete(':productId')
  @ApiOperation({ summary: 'Remover produto da lista de desejos (idempotente)' })
  async remove(
    @CurrentUser('sub') userId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return ok(await this.favorites.remove(userId, productId));
  }
}
