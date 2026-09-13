import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ok } from '../../common/http';
import { OptionalJwtGuard } from '../../common/guards/optional-jwt.guard';
import { ChatMessageDto } from './chat.dto';
import { ChatService } from './chat.service';

@Controller('chat')
@UseGuards(OptionalJwtGuard)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  /** Status público do Schimitz AI — sem segredos. */
  @Get('status')
  status() {
    return ok(this.chat.status());
  }

  /** Assistente da loja (público). JWT opcional só para tools de pedido do próprio user. */
  @Post()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async message(@Body() dto: ChatMessageDto, @Req() req: { user?: { sub?: string } }) {
    return ok(
      await this.chat.reply({
        message: dto.message,
        conversationId: dto.conversationId,
        userId: req.user?.sub,
      }),
    );
  }
}
