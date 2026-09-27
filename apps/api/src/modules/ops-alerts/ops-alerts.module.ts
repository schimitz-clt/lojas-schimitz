import { Global, Module } from '@nestjs/common';
import { OpsAlertsService } from './ops-alerts.service';

@Global()
@Module({
  providers: [OpsAlertsService],
  exports: [OpsAlertsService],
})
export class OpsAlertsModule {}
