import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ok } from '../../common/http';
import { ChatMessageDto } from './chat.dto';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  /** Assistente da loja (público). Rate limit mais apertado que o global. */
  @Post()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async message(@Body() dto: ChatMessageDto) {
    return ok(await this.chat.reply({ message: dto.message, conversationId: dto.conversationId }));
  }
}
