import { Body, Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ok } from '../../common/http';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AccountDeletionService } from './account-deletion.service';
import { DELETION_REASON_MAX } from './account-deletion.rules';

export class RequestAccountDeletionDto {
  @IsOptional()
  @IsString()
  @MaxLength(DELETION_REASON_MAX)
  reason?: string;
}

@ApiTags('me')
@ApiBearerAuth('access-token')
@Controller('me/account-deletion')
@UseGuards(JwtAuthGuard)
export class MeAccountDeletionController {
  constructor(@Inject(AccountDeletionService) private readonly deletion: AccountDeletionService) {}

  @Get()
  @ApiOperation({ summary: 'Status do meu pedido de exclusão de conta' })
  async status(@CurrentUser('sub') userId: string) {
    return ok(await this.deletion.status(userId));
  }

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Pedir exclusão da conta (registra para a loja processar; idempotente)' })
  async request(@CurrentUser('sub') userId: string, @Body() dto: RequestAccountDeletionDto) {
    return ok(await this.deletion.request(userId, dto?.reason));
  }

  @Delete()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Desistir do pedido de exclusão ainda não processado' })
  async cancel(@CurrentUser('sub') userId: string) {
    return ok(await this.deletion.cancel(userId));
  }
}

@ApiTags('admin')
@ApiBearerAuth('access-token')
@Controller('admin/account-deletion-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminAccountDeletionController {
  constructor(@Inject(AccountDeletionService) private readonly deletion: AccountDeletionService) {}

  @Get()
  @ApiOperation({ summary: 'Pedidos de exclusão de conta pendentes' })
  async list() {
    return ok(await this.deletion.listPending());
  }

  @Post(':userId/process')
  @ApiOperation({ summary: 'Anonimizar a conta (mantém pedidos/pagamentos/cashback/auditoria)' })
  async process(@CurrentUser('sub') actorId: string, @Param('userId', new ParseUUIDPipe()) userId: string) {
    return ok(await this.deletion.process(actorId, userId));
  }
}
