import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { availableQty } from '../inventory/inventory.math';
import { PushFcmClient } from './push-fcm.client';
import { fcmDataPayload } from './push-deeplink';
import { fcmTokenFingerprint, resolveTokenUserId } from './push-token.rules';
import {
  abandonedViewAdminNote,
  abandonedViewDelayHours,
  abandonedViewDelayMs,
  abandonedViewMaxAgeMs,
  abandonedViewMessage,
  ABANDONED_VIEW_KIND,
  decideAbandonedView,
  normalizePushDeviceId,
  purchaseUserIds,
  readPushDeviceCookie,
} from './abandoned-view.rules';

const BATCH = 15;

type DueRow = {
  id: string;
  deviceId: string;
  productId: string;
  userId: string | null;
  lastViewedAt: Date;
  handledViewAt: Date | null;
  device: { id: string; token: string; enabled: boolean; userId: string | null };
  product: {
    id: string;
    name: string;
    slug: string;
    price: { toString(): string } | number | string;
    active: boolean;
    inventory: { qtyOnHand: number; qtyReserved: number } | null;
  };
};

@Injectable()
export class AbandonedViewService {
  private readonly log = new Logger(AbandonedViewService.name);
  private warnedUnconfigured = false;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PushFcmClient) private readonly fcm: PushFcmClient,
  ) {}

  /**
   * Record a PDP view for a real registered device. Missing/unknown device is a no-op
   * (does not create a token). Logged-in userId is stored; a later guest view does not unlink it.
   */
  async record(input: {
    productId?: string | null;
    slug?: string | null;
    deviceId?: string | null;
    cookieHeader?: string | string[];
    requestUserId?: string | null;
  }) {
    const deviceId =
      normalizePushDeviceId(input.deviceId) || readPushDeviceCookie(input.cookieHeader);
    if (!deviceId) return { recorded: false, reason: 'no_device' as const };

    const device = await this.prisma.deviceFcmToken.findUnique({
      where: { id: deviceId },
      select: { id: true, enabled: true },
    });
    if (!device || !device.enabled) return { recorded: false, reason: 'no_device' as const };

    const productId = String(input.productId || '').trim();
    const slug = String(input.slug || '').trim();
    const product = productId
      ? await this.prisma.product.findUnique({
          where: { id: productId },
          select: { id: true },
        })
      : slug
        ? await this.prisma.product.findUnique({
            where: { slug },
            select: { id: true },
          })
        : null;
    if (!product) return { recorded: false, reason: 'no_product' as const };

    const existing = await this.prisma.productViewEvent.findUnique({
      where: { deviceId_productId: { deviceId: device.id, productId: product.id } },
      select: { userId: true },
    });
    const userId = resolveTokenUserId({
      existingUserId: existing?.userId,
      requestUserId: input.requestUserId,
    });
    const now = new Date();
    await this.prisma.productViewEvent.upsert({
      where: { deviceId_productId: { deviceId: device.id, productId: product.id } },
      create: {
        deviceId: device.id,
        productId: product.id,
        userId,
        lastViewedAt: now,
      },
      update: {
        userId,
        lastViewedAt: now,
        deferUntil: null,
      },
    });
    return { recorded: true, reason: 'ok' as const, deviceId: device.id, productId: product.id };
  }

  /** Read-only counts for Admin. Does not send. */
  async preview(now = new Date()) {
    const delayMs = abandonedViewDelayMs();
    const cutoff = new Date(now.getTime() - delayMs);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const [openRows, dueRows, sentRows] = await Promise.all([
      this.prisma.$queryRaw<{ n: number }[]>`
        SELECT COUNT(*)::int AS n
        FROM "ProductViewEvent"
        WHERE "handledViewAt" IS NULL OR "handledViewAt" < "lastViewedAt"
      `,
      this.prisma.$queryRaw<{ n: number }[]>`
        SELECT COUNT(*)::int AS n
        FROM "ProductViewEvent"
        WHERE "lastViewedAt" <= ${cutoff}
          AND ("handledViewAt" IS NULL OR "handledViewAt" < "lastViewedAt")
          AND ("deferUntil" IS NULL OR "deferUntil" <= ${now})
      `,
      this.prisma.$queryRaw<{ n: number }[]>`
        SELECT COUNT(*)::int AS n
        FROM "AbandonedViewPush"
        WHERE "status" = 'sent' AND "sentAt" >= ${sevenDaysAgo}
      `,
    ]);
    const delayHours = abandonedViewDelayHours();
    return {
      automatic: true,
      delayHours,
      maxAgeHours: abandonedViewMaxAgeMs() / (60 * 60 * 1000),
      timezone: 'America/Sao_Paulo',
      caps: { perDeviceProductDays: 7, perDeviceCalendarDay: 1 },
      openViews: Number(openRows[0]?.n ?? 0),
      dueViews: Number(dueRows[0]?.n ?? 0),
      sentLast7Days: Number(sentRows[0]?.n ?? 0),
      firebaseConfigured: this.fcm.isConfigured(),
      note: abandonedViewAdminNote(delayHours),
      sends: false,
    };
  }

  async processDue(now = new Date()) {
    const delayMs = abandonedViewDelayMs();
    const maxAgeMs = abandonedViewMaxAgeMs(process.env, delayMs);
    const cutoff = new Date(now.getTime() - delayMs);
    const idRows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "ProductViewEvent"
      WHERE "lastViewedAt" <= ${cutoff}
        AND ("handledViewAt" IS NULL OR "handledViewAt" < "lastViewedAt")
        AND ("deferUntil" IS NULL OR "deferUntil" <= ${now})
      ORDER BY "lastViewedAt" ASC
      LIMIT ${BATCH}
    `;
    if (!idRows.length) return { processed: 0, sent: 0, closed: 0, deferred: 0 };

    const rows = (await this.prisma.productViewEvent.findMany({
      where: { id: { in: idRows.map((r) => r.id) } },
      include: {
        device: { select: { id: true, token: true, enabled: true, userId: true } },
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            active: true,
            inventory: { select: { qtyOnHand: true, qtyReserved: true } },
          },
        },
      },
    })) as DueRow[];
    rows.sort((a, b) => a.lastViewedAt.getTime() - b.lastViewedAt.getTime());

    const firebaseConfigured = this.fcm.isConfigured();
    const sentAtByDevice = new Map<string, Date>();
    const sentAtByPair = new Map<string, Date>();
    let sent = 0;
    let closed = 0;
    let deferred = 0;

    for (const view of rows) {
      const pairKey = `${view.deviceId}:${view.productId}`;
      const [lastProduct, lastDevice, purchasedAfterView] = await Promise.all([
        this.latestSent(view.deviceId, view.productId),
        this.latestSent(view.deviceId, null),
        this.purchasedAfter(view),
      ]);
      const lastProductPushAt = laterDate(lastProduct, sentAtByPair.get(pairKey) ?? null);
      const lastDevicePushAt = laterDate(lastDevice, sentAtByDevice.get(view.deviceId) ?? null);
      const qty = view.product.inventory
        ? availableQty(view.product.inventory.qtyOnHand, view.product.inventory.qtyReserved)
        : 0;
      const decision = decideAbandonedView({
        now,
        lastViewedAt: view.lastViewedAt,
        handledViewAt: view.handledViewAt,
        delayMs,
        maxAgeMs,
        deviceEnabled: view.device.enabled,
        productActive: view.product.active,
        availableQty: qty,
        purchasedAfterView,
        lastProductPushAt,
        lastDevicePushAt,
        firebaseConfigured,
      });

      if (decision.action === 'wait') {
        if ('deferUntil' in decision) {
          await this.deferView(view.id, view.lastViewedAt, decision.deferUntil);
        }
        continue;
      }
      if (decision.action === 'defer') {
        deferred += 1;
        this.warnUnconfigured();
        continue;
      }
      if (decision.action === 'close') {
        const n = await this.closeView(view.id, view.lastViewedAt);
        if (n) closed += 1;
        continue;
      }

      const message = abandonedViewMessage({
        productName: view.product.name,
        listPrice: Number(String(view.product.price)),
        slug: view.product.slug,
      });
      if (!message) {
        const n = await this.closeView(view.id, view.lastViewedAt);
        if (n) closed += 1;
        continue;
      }

      const claimed = await this.closeView(view.id, view.lastViewedAt);
      if (!claimed) continue;

      const send = await this.fcm.sendToTokens([view.device.token], {
        title: message.title,
        body: message.body,
        data: fcmDataPayload({
          path: message.linkPath,
          url: message.linkUrl,
          kind: ABANDONED_VIEW_KIND,
        }),
      });
      if (!send.configured) {
        await this.prisma.productViewEvent.update({
          where: { id: view.id },
          data: { handledViewAt: view.handledViewAt },
        });
        deferred += 1;
        this.warnUnconfigured();
        break;
      }

      const result = send.results[0];
      const ok = Boolean(result?.success);
      await this.prisma.abandonedViewPush.create({
        data: {
          deviceId: view.deviceId,
          productId: view.productId,
          userId: view.userId || view.device.userId,
          status: ok ? 'sent' : 'failed',
          error: ok
            ? null
            : String(result?.errorCode || result?.errorMessage || 'send_failed').slice(0, 300),
          fcmMessageId: result?.messageId || null,
          tokenFingerprint: fcmTokenFingerprint(view.device.token),
        },
      });
      if (result?.disableToken) {
        await this.prisma.deviceFcmToken.update({
          where: { id: view.deviceId },
          data: { enabled: false },
        });
      }
      if (ok) {
        sent += 1;
        sentAtByDevice.set(view.deviceId, now);
        sentAtByPair.set(pairKey, now);
      } else {
        closed += 1;
      }
    }

    if (sent || closed) {
      this.log.log(`Recuperação de produto: sent=${sent} closed=${closed} deferred=${deferred}`);
    }
    return { processed: rows.length, sent, closed, deferred };
  }

  private async latestSent(deviceId: string, productId: string | null): Promise<Date | null> {
    const row = await this.prisma.abandonedViewPush.findFirst({
      where: {
        deviceId,
        status: 'sent',
        ...(productId ? { productId } : {}),
      },
      orderBy: { sentAt: 'desc' },
      select: { sentAt: true },
    });
    return row?.sentAt ?? null;
  }

  private async purchasedAfter(view: DueRow): Promise<boolean> {
    const userIds = purchaseUserIds(view.userId, view.device.userId);
    if (!userIds.length) return false;
    const order = await this.prisma.order.findFirst({
      where: {
        userId: { in: userIds },
        items: { some: { productId: view.productId } },
        OR: [
          {
            createdAt: { gte: view.lastViewedAt },
            status: { notIn: ['draft', 'cancelled'] },
          },
          {
            payments: {
              some: {
                status: 'approved',
                updatedAt: { gte: view.lastViewedAt },
              },
            },
          },
        ],
      },
      select: { id: true },
    });
    return Boolean(order);
  }

  /** Park a capped view until the cap lifts, without burning the snapshot. */
  private async deferView(id: string, lastViewedAt: Date, until: Date): Promise<void> {
    await this.prisma.productViewEvent.updateMany({
      where: {
        id,
        lastViewedAt,
        OR: [{ handledViewAt: null }, { handledViewAt: { lt: lastViewedAt } }],
      },
      data: { deferUntil: until },
    });
  }

  /** Mark this view snapshot decided. Returns 1 only if lastViewedAt did not slide. */
  private async closeView(id: string, lastViewedAt: Date): Promise<number> {
    const res = await this.prisma.productViewEvent.updateMany({
      where: {
        id,
        lastViewedAt,
        OR: [{ handledViewAt: null }, { handledViewAt: { lt: lastViewedAt } }],
      },
      data: { handledViewAt: lastViewedAt },
    });
    return res.count;
  }

  private warnUnconfigured() {
    if (this.warnedUnconfigured) return;
    this.warnedUnconfigured = true;
    this.log.warn('Recuperação de produto NÃO EXECUTADO: Firebase Admin sem credenciais');
  }
}

function laterDate(a: Date | null, b: Date | null): Date | null {
  if (!a) return b;
  if (!b) return a;
  return a.getTime() >= b.getTime() ? a : b;
}
