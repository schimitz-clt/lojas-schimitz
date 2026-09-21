import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { OptionalJwtGuard } from '../../common/guards/optional-jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ok } from '../../common/http';
import { UpsertPushTokenDto } from './dto';
import { PushTokensService } from './push-tokens.service';

@ApiTags('push')
@Controller('push')
export class PushTokensController {
  constructor(private readonly tokens: PushTokensService) {}

  @Post('tokens')
  @UseGuards(OptionalJwtGuard)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({
    summary:
      'Upsert token FCM do aparelho Android. Cookie/JWT opcional: logado vincula userId; visitante fica userId nulo. Token único.',
  })
  async upsert(
    @Body() dto: UpsertPushTokenDto,
    @CurrentUser('sub') userId?: string,
  ) {
    return ok(
      await this.tokens.upsert({
        token: dto.token,
        platform: dto.platform,
        enabled: dto.enabled,
        appVersion: dto.appVersion,
        requestUserId: userId || null,
      }),
    );
  }
}
