import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AccountDeletionService } from './account-deletion.service';
import { AdminAccountDeletionController, MeAccountDeletionController } from './account-deletion.controller';

@Module({
  imports: [JwtModule.register({})],
  controllers: [MeAccountDeletionController, AdminAccountDeletionController],
  providers: [AccountDeletionService],
  exports: [AccountDeletionService],
})
export class AccountDeletionModule {}
