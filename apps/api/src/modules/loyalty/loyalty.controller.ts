import { Controller, Get, UseGuards } from '@nestjs/common';
import { ok } from '../../common/http';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LoyaltyService } from './loyalty.service';

@Controller('me/loyalty')
@UseGuards(JwtAuthGuard)
export class LoyaltyController {
  constructor(private readonly loyalty: LoyaltyService) {}

  @Get()
  async summary(@CurrentUser('sub') userId: string) {
    return ok(await this.loyalty.getSummary(userId));
  }
}
