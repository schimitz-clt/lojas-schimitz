import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ok } from '../../common/http';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AddressesService } from './addresses.service';
import { CreateAddressDto, UpdateAddressDto } from './dto';

@ApiTags('addresses')
@ApiBearerAuth('access-token')
@Controller('me/addresses')
@UseGuards(JwtAuthGuard)
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar meus endereços' })
  async list(@CurrentUser('sub') userId: string) {
    return ok(await this.addresses.list(userId));
  }

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Criar endereço (scoped ao usuário)' })
  async create(@CurrentUser('sub') userId: string, @Body() dto: CreateAddressDto) {
    return ok(await this.addresses.create(userId, dto));
  }

  @Patch(':id')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Atualizar endereço próprio (404 se outro usuário)' })
  async update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return ok(await this.addresses.update(userId, id, dto));
  }

  @Delete(':id')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Remover endereço próprio (404 se outro usuário)' })
  async remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return ok(await this.addresses.remove(userId, id));
  }
}
