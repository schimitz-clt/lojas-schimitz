import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OptionalJwtGuard } from '../../common/guards/optional-jwt.guard';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [AuthModule],
  controllers: [ChatController],
  providers: [ChatService, OptionalJwtGuard],
})
export class ChatModule {}
