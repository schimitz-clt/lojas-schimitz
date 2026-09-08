import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ok } from '../../common/http';
import { OptionalJwtGuard } from '../../common/guards/optional-jwt.guard';
import { CartService } from './cart.service';
import { AddCartItemDto, UpdateCartItemDto } from './dto';

@ApiTags('cart')
@ApiSecurity('guest-token')
@ApiBearerAuth('access-token')
@Controller('cart')
@UseGuards(OptionalJwtGuard)
export class CartController {
  constructor(private readonly cart: CartService) {}

  private ids(req: { user?: { sub?: string } }, guestToken?: string) {
    const userId = req.user?.sub;
    return { userId, guestToken: guestToken || undefined };
  }

  @Get()
  @ApiOperation({ summary: 'Obter carrinho (user ou guest)' })
  async get(@Req() req: { user?: { sub?: string } }, @Headers('x-guest-token') guestToken?: string) {
    const { userId } = this.ids(req, guestToken);
    return ok(await this.cart.getCart(userId, guestToken));
  }

  @Post('items')
  @ApiOperation({ summary: 'Adicionar item ao carrinho' })
  async add(
    @Req() req: { user?: { sub?: string } },
    @Body() dto: AddCartItemDto,
    @Headers('x-guest-token') guestToken?: string,
  ) {
    const { userId } = this.ids(req, guestToken);
    return ok(await this.cart.addItem(dto, userId, guestToken));
  }

  @Patch('items/:id')
  @ApiOperation({ summary: 'Atualizar quantidade do item' })
  async update(
    @Req() req: { user?: { sub?: string } },
    @Param('id') id: string,
    @Body() dto: UpdateCartItemDto,
    @Headers('x-guest-token') guestToken?: string,
  ) {
    const { userId } = this.ids(req, guestToken);
    return ok(await this.cart.updateItem(id, dto, userId, guestToken));
  }

  @Delete('items/:id')
  @ApiOperation({ summary: 'Remover item do carrinho' })
  async remove(
    @Req() req: { user?: { sub?: string } },
    @Param('id') id: string,
    @Headers('x-guest-token') guestToken?: string,
  ) {
    const { userId } = this.ids(req, guestToken);
    return ok(await this.cart.removeItem(id, userId, guestToken));
  }

  @Delete()
  @ApiOperation({ summary: 'Esvaziar carrinho' })
  async clear(@Req() req: { user?: { sub?: string } }, @Headers('x-guest-token') guestToken?: string) {
    const { userId } = this.ids(req, guestToken);
    return ok(await this.cart.clear(userId, guestToken));
  }
}
