import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ok } from '../../common/http';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateMeDto } from './dto';

@Controller('me')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async getMe(@CurrentUser('sub') userId: string) {
    return ok(await this.users.getMe(userId));
  }

  @Patch()
  async updateMe(@CurrentUser('sub') userId: string, @Body() dto: UpdateMeDto) {
    return ok(await this.users.updateMe(userId, dto));
  }
}
