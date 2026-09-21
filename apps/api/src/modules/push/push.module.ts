import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PushTokensController } from './push-tokens.controller';
import { AdminPushController } from './admin-push.controller';
import { PushTokensService } from './push-tokens.service';
import { PushCampaignsService } from './push-campaigns.service';
import { PushSchedulerService } from './push-scheduler.service';
import { PushFcmClient } from './push-fcm.client';
import { AbandonedViewService } from './abandoned-view.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [PushTokensController, AdminPushController],
  providers: [
    PushFcmClient,
    PushTokensService,
    PushCampaignsService,
    AbandonedViewService,
    PushSchedulerService,
  ],
  exports: [PushTokensService, PushCampaignsService, AbandonedViewService],
})
export class PushModule {}
