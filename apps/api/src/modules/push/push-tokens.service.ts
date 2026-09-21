import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import {
  resolveTokenUserId,
  validateTokenUpsert,
} from './push-token.rules';

@Injectable()
export class PushTokensService {
  private readonly log = new Logger(PushTokensService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async upsert(input: {
    token: string;
    platform?: string;
    enabled?: boolean;
    appVersion?: string;
    requestUserId?: string | null;
  }) {
    const parsed = validateTokenUpsert(input);
    if (!parsed.ok) {
      throw new BadRequestException({ code: parsed.code, message: parsed.message });
    }
    const existing = await this.prisma.deviceFcmToken.findUnique({
      where: { token: parsed.value.token },
      select: { id: true, userId: true },
    });
    const userId = resolveTokenUserId({
      existingUserId: existing?.userId,
      requestUserId: input.requestUserId,
    });
    const row = await this.prisma.deviceFcmToken.upsert({
      where: { token: parsed.value.token },
      create: {
        token: parsed.value.token,
        platform: parsed.value.platform,
        enabled: parsed.value.enabled,
        appVersion: parsed.value.appVersion,
        userId,
        lastSeenAt: new Date(),
      },
      update: {
        platform: parsed.value.platform,
        enabled: parsed.value.enabled,
        appVersion: parsed.value.appVersion,
        userId,
        lastSeenAt: new Date(),
      },
    });
    this.log.log(
      `FCM token upsert id=${row.id} enabled=${row.enabled} userBound=${Boolean(row.userId)}`,
    );
    return {
      id: row.id,
      platform: row.platform,
      enabled: row.enabled,
      lastSeenAt: row.lastSeenAt,
      userBound: Boolean(row.userId),
    };
  }

  async listForAdmin(opts?: { take?: number }) {
    const take = Math.min(Math.max(opts?.take ?? 50, 1), 100);
    const [items, enabledCount, total] = await Promise.all([
      this.prisma.deviceFcmToken.findMany({
        orderBy: { lastSeenAt: 'desc' },
        take,
        select: {
          id: true,
          platform: true,
          enabled: true,
          lastSeenAt: true,
          appVersion: true,
          userId: true,
          createdAt: true,
          user: { select: { orders: { select: { id: true }, take: 1 } } },
        },
      }),
      this.prisma.deviceFcmToken.count({ where: { enabled: true } }),
      this.prisma.deviceFcmToken.count(),
    ]);
    return {
      total,
      enabledCount,
      items: items.map((r) => ({
        id: r.id,
        platform: r.platform,
        enabled: r.enabled,
        lastSeenAt: r.lastSeenAt,
        appVersion: r.appVersion,
        userBound: Boolean(r.userId),
        hasOrders: Boolean(r.user?.orders?.length),
        createdAt: r.createdAt,
      })),
    };
  }
}
