import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ok } from '../../common/http';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  async list(
    @CurrentUser('sub') userId: string,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('limit') limit?: string,
  ) {
    return ok(
      await this.notifications.listForUser(userId, {
        unreadOnly: unreadOnly === '1' || unreadOnly === 'true',
        limit: limit ? Number(limit) : undefined,
      }),
    );
  }

  @Post('read-all')
  async markAllRead(@CurrentUser('sub') userId: string) {
    return ok(await this.notifications.markAllRead(userId));
  }

  @Post(':id/read')
  async markRead(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return ok(await this.notifications.markRead(userId, id));
  }
}
