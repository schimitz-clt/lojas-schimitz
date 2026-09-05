import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ok } from '../../common/http';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AddressesService } from './addresses.service';
import { CreateAddressDto, UpdateAddressDto } from './dto';

@Controller('me/addresses')
@UseGuards(JwtAuthGuard)
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get()
  async list(@CurrentUser('sub') userId: string) {
    return ok(await this.addresses.list(userId));
  }

  @Post()
  async create(@CurrentUser('sub') userId: string, @Body() dto: CreateAddressDto) {
    return ok(await this.addresses.create(userId, dto));
  }

  @Patch(':id')
  async update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return ok(await this.addresses.update(userId, id, dto));
  }

  @Delete(':id')
  async remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return ok(await this.addresses.remove(userId, id));
  }
}
