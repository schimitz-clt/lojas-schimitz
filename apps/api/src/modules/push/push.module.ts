import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PushTokensController } from './push-tokens.controller';
import { AdminPushController } from './admin-push.controller';
import { PushTokensService } from './push-tokens.service';
import { PushCampaignsService } from './push-campaigns.service';
import { PushSchedulerService } from './push-scheduler.service';
import { PushFcmClient } from './push-fcm.client';

@Module({
  imports: [JwtModule.register({})],
  controllers: [PushTokensController, AdminPushController],
  providers: [PushFcmClient, PushTokensService, PushCampaignsService, PushSchedulerService],
  exports: [PushTokensService, PushCampaignsService],
})
export class PushModule {}
