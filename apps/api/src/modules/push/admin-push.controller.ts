import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ok } from '../../common/http';
import { AdminPushTestDto, CreatePushCampaignDto } from './dto';
import { PushCampaignsService } from './push-campaigns.service';
import { PushTokensService } from './push-tokens.service';
import { AbandonedViewService } from './abandoned-view.service';

@ApiTags('admin-push')
@ApiBearerAuth('access-token')
@Controller('admin/push')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminPushController {
  constructor(
    private readonly campaigns: PushCampaignsService,
    private readonly tokens: PushTokensService,
    private readonly abandoned: AbandonedViewService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Firebase Admin configurado? Sem valores de segredo.' })
  status() {
    return ok(this.campaigns.status());
  }

  @Get('abandoned-views')
  @ApiOperation({
    summary:
      'Contagem somente leitura da recuperação automática de produto. Não envia push.',
  })
  async abandonedViews() {
    return ok(await this.abandoned.preview());
  }

  @Get('tokens')
  @ApiOperation({ summary: 'Aparelhos com token FCM (sem o token completo).' })
  async listTokens(@Query('take') take?: string) {
    return ok(await this.tokens.listForAdmin({ take: take ? Number(take) : undefined }));
  }

  @Get('campaigns')
  @ApiOperation({ summary: 'Histórico de campanhas push promocionais.' })
  async listCampaigns(@Query('take') take?: string) {
    return ok(await this.campaigns.list({ take: take ? Number(take) : undefined }));
  }

  @Get('campaigns/:id')
  @ApiOperation({ summary: 'Detalhe + últimos envios (fingerprint do token, sem segredo).' })
  async getCampaign(@Param('id') id: string) {
    return ok(await this.campaigns.get(id));
  }

  @Post('campaigns')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Criar campanha: enviar agora ou agendar.' })
  async create(
    @Body() dto: CreatePushCampaignDto,
    @CurrentUser('sub') userId: string,
  ) {
    return ok(await this.campaigns.create(dto as unknown as Record<string, unknown>, userId));
  }

  @Post('campaigns/:id/cancel')
  @ApiOperation({ summary: 'Cancelar campanha ainda agendada.' })
  async cancel(@Param('id') id: string) {
    return ok(await this.campaigns.cancel(id));
  }

  @Post('campaigns/:id/send')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Disparar agora uma campanha agendada (admin).' })
  async sendNow(@Param('id') id: string) {
    return ok(await this.campaigns.dispatch(id));
  }

  @Post('test')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Enviar push de teste para um tokenId (seu aparelho).' })
  async test(@Body() dto: AdminPushTestDto, @CurrentUser('sub') userId: string) {
    return ok(
      await this.campaigns.testSend({
        tokenId: dto.tokenId,
        title: dto.title,
        body: dto.body,
        linkPath: dto.linkPath,
        createdById: userId,
      }),
    );
  }
}
