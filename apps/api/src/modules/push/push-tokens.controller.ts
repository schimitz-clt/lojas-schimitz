import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { OptionalJwtGuard } from '../../common/guards/optional-jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ok } from '../../common/http';
import { RecordProductViewDto, UpsertPushTokenDto } from './dto';
import { PushTokensService } from './push-tokens.service';
import { AbandonedViewService } from './abandoned-view.service';

@ApiTags('push')
@Controller('push')
export class PushTokensController {
  constructor(
    private readonly tokens: PushTokensService,
    private readonly abandoned: AbandonedViewService,
  ) {}

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

  @Post('product-views')
  @UseGuards(OptionalJwtGuard)
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @ApiOperation({
    summary:
      'Registra visita à PDP para o aparelho FCM (cookie sch_push_device ou deviceId). Sem token registrado: no-op. Não cria token.',
  })
  async recordProductView(
    @Body() dto: RecordProductViewDto,
    @CurrentUser('sub') userId: string | undefined,
    @Req() req: { headers: { cookie?: string | string[] } },
  ) {
    return ok(
      await this.abandoned.record({
        productId: dto.productId,
        slug: dto.slug,
        deviceId: dto.deviceId,
        cookieHeader: req.headers.cookie,
        requestUserId: userId || null,
      }),
    );
  }
}
