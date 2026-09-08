import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ok } from '../../common/http';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { requireIdempotencyKey } from '../orders/idempotency';
import { PaymentsService } from './payments.service';
import { CreatePaymentIntentDto } from './dto';

@ApiTags('payments')
@ApiBearerAuth('access-token')
@Controller('payments')
export class PaymentsController {
  constructor(@Inject(PaymentsService) private readonly payments: PaymentsService) {}

  @Post('intents')
  @ApiOperation({ summary: 'Criar intent PIX/cartão' })
  @ApiSecurity('idempotency-key')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async createIntent(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreatePaymentIntentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const key = requireIdempotencyKey(idempotencyKey);
    return ok(await this.payments.createIntent(userId, dto, key));
  }

  @Get('order/:orderId')
  @ApiOperation({ summary: 'Pagamentos do pedido (próprio)' })
  @UseGuards(JwtAuthGuard)
  async byOrder(@CurrentUser('sub') userId: string, @Param('orderId') orderId: string) {
    return ok(await this.payments.getByOrder(userId, orderId));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar pagamento (próprio)' })
  @UseGuards(JwtAuthGuard)
  async get(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return ok(await this.payments.getPayment(userId, id));
  }
}

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(@Inject(PaymentsService) private readonly payments: PaymentsService) {}

  @Post('mercadopago')
  @ApiOperation({ summary: 'Webhook Mercado Pago (assinatura obrigatória)' })
  @HttpCode(200)
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  async mercadopago(@Req() req: any, @Body() body: unknown) {
    const result = await this.payments.handleWebhook(req.headers || {}, body);
    return ok(result);
  }
}
