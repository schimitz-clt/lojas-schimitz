import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { PushFcmClient } from './push-fcm.client';
import {
  audienceTokenWhere,
  canCancelCampaign,
  chunkTokens,
  emptyAudienceSummary,
  firebaseNotConfiguredSummary,
  initialCampaignStatus,
  validateCampaignDraft,
  type PushAudienceId,
} from './push-campaign.rules';
import { fcmDataPayload } from './push-deeplink';
import { fcmTokenFingerprint } from './push-token.rules';

@Injectable()
export class PushCampaignsService {
  private readonly log = new Logger(PushCampaignsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PushFcmClient) private readonly fcm: PushFcmClient,
  ) {}

  status() {
    const s = this.fcm.status();
    return {
      firebaseConfigured: s.configured,
      firebaseSource: s.source,
      firebaseProjectId: s.projectId,
      firebaseReason: s.reason,
      note: s.configured
        ? 'Firebase Admin pronto para envio real'
        : 'NÃO EXECUTADO até o dono adicionar FIREBASE_SERVICE_ACCOUNT_JSON no Railway (API)',
    };
  }

  async list(opts?: { take?: number }) {
    const take = Math.min(Math.max(opts?.take ?? 40, 1), 80);
    const [items, total, tokenStats] = await Promise.all([
      this.prisma.pushCampaign.findMany({
        orderBy: { createdAt: 'desc' },
        take,
        select: {
          id: true,
          title: true,
          body: true,
          imageUrl: true,
          linkPath: true,
          audience: true,
          status: true,
          scheduledAt: true,
          sentAt: true,
          sentCount: true,
          failedCount: true,
          skippedCount: true,
          errorSummary: true,
          firebaseReady: true,
          createdAt: true,
        },
      }),
      this.prisma.pushCampaign.count(),
      this.prisma.deviceFcmToken.aggregate({
        _count: { _all: true },
        where: { enabled: true },
      }),
    ]);
    return {
      total,
      enabledDevices: tokenStats._count._all,
      firebase: this.status(),
      items,
    };
  }

  async get(id: string) {
    const campaign = await this.prisma.pushCampaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException({ code: 'PUSH_CAMPAIGN_NOT_FOUND', message: 'Campanha não encontrada' });
    const dispatches = await this.prisma.pushDispatch.findMany({
      where: { campaignId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        status: true,
        error: true,
        tokenFingerprint: true,
        fcmMessageId: true,
        createdAt: true,
      },
    });
    return { campaign, dispatches, firebase: this.status() };
  }

  async create(input: Record<string, unknown>, createdById: string) {
    const parsed = validateCampaignDraft(input);
    if (!parsed.ok) {
      throw new BadRequestException({ code: parsed.code, message: parsed.message });
    }
    const firebaseReady = this.fcm.isConfigured();
    const status = initialCampaignStatus(parsed.value.sendMode);
    const row = await this.prisma.pushCampaign.create({
      data: {
        title: parsed.value.title,
        body: parsed.value.body,
        imageUrl: parsed.value.imageUrl,
        linkPath: parsed.value.linkPath,
        audience: parsed.value.audience,
        status,
        scheduledAt: parsed.value.scheduledAt,
        createdById,
        firebaseReady,
      },
    });
    if (parsed.value.sendMode === 'immediate') {
      return this.dispatch(row.id);
    }
    return { campaign: row, firebase: this.status(), dispatched: false };
  }

  async cancel(id: string) {
    const campaign = await this.prisma.pushCampaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException({ code: 'PUSH_CAMPAIGN_NOT_FOUND', message: 'Campanha não encontrada' });
    if (!canCancelCampaign(campaign.status)) {
      throw new BadRequestException({
        code: 'PUSH_CAMPAIGN_NOT_CANCELLABLE',
        message: 'Só é possível cancelar campanhas agendadas',
      });
    }
    const updated = await this.prisma.pushCampaign.update({
      where: { id },
      data: { status: 'cancelled' },
    });
    return { campaign: updated };
  }

  async dispatchDue(now = new Date()) {
    const due = await this.prisma.pushCampaign.findMany({
      where: {
        status: 'scheduled',
        scheduledAt: { lte: now },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 5,
      select: { id: true },
    });
    const results = [];
    for (const c of due) {
      results.push(await this.dispatch(c.id));
    }
    return { processed: results.length, results };
  }

  async dispatch(campaignId: string) {
    const existing = await this.prisma.pushCampaign.findUnique({ where: { id: campaignId } });
    if (!existing) {
      throw new NotFoundException({ code: 'PUSH_CAMPAIGN_NOT_FOUND', message: 'Campanha não encontrada' });
    }
    if (existing.status === 'sent' || existing.status === 'failed' || existing.status === 'cancelled') {
      return { campaign: existing, dispatched: false, reason: 'already_final' };
    }
    const prior = await this.prisma.pushDispatch.count({ where: { campaignId } });
    if (prior > 0) {
      return { campaign: existing, dispatched: false, reason: 'already_dispatched' };
    }
    const claimed = await this.prisma.pushCampaign.updateMany({
      where: {
        id: campaignId,
        status: { in: ['sending', 'scheduled'] },
      },
      data: { status: 'sending' },
    });
    if (claimed.count !== 1) {
      const latest = await this.prisma.pushCampaign.findUnique({ where: { id: campaignId } });
      return { campaign: latest || existing, dispatched: false, reason: 'already_final' };
    }

    const campaign = await this.prisma.pushCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign) {
      throw new NotFoundException({ code: 'PUSH_CAMPAIGN_NOT_FOUND', message: 'Campanha não encontrada' });
    }

    const where = audienceTokenWhere(campaign.audience as PushAudienceId) as Prisma.DeviceFcmTokenWhereInput;
    const devices = await this.prisma.deviceFcmToken.findMany({
      where,
      select: { id: true, token: true },
    });

    if (!devices.length) {
      const updated = await this.prisma.pushCampaign.update({
        where: { id: campaignId },
        data: {
          status: 'sent',
          sentAt: new Date(),
          sentCount: 0,
          failedCount: 0,
          skippedCount: 0,
          errorSummary: emptyAudienceSummary(),
          firebaseReady: this.fcm.isConfigured(),
        },
      });
      return { campaign: updated, dispatched: true, reason: 'empty_audience' };
    }

    if (!this.fcm.isConfigured()) {
      const summary = firebaseNotConfiguredSummary();
      await this.prisma.pushDispatch.createMany({
        data: devices.map((d) => ({
          campaignId,
          tokenId: d.id,
          tokenFingerprint: fcmTokenFingerprint(d.token),
          status: 'skipped' as const,
          error: summary,
        })),
      });
      const updated = await this.prisma.pushCampaign.update({
        where: { id: campaignId },
        data: {
          status: 'failed',
          sentAt: new Date(),
          sentCount: 0,
          failedCount: 0,
          skippedCount: devices.length,
          errorSummary: summary,
          firebaseReady: false,
        },
      });
      this.log.warn(`Campanha ${campaignId} ${summary}`);
      return { campaign: updated, dispatched: false, reason: 'nao_executado' };
    }

    const data = fcmDataPayload({
      path: campaign.linkPath,
      url: `https://lojasschimitz.com.br${campaign.linkPath.startsWith('/') ? campaign.linkPath : `/${campaign.linkPath}`}`,
      campaignId: campaign.id,
    });
    const batches = chunkTokens(devices);
    let sentCount = 0;
    let failedCount = 0;
    const disableIds: string[] = [];

    for (const batch of batches) {
      const send = await this.fcm.sendToTokens(
        batch.map((d) => d.token),
        {
          title: campaign.title,
          body: campaign.body,
          imageUrl: campaign.imageUrl,
          data,
        },
      );
      const byToken = new Map(batch.map((d) => [d.token, d]));
      const rows: Prisma.PushDispatchCreateManyInput[] = [];
      for (const r of send.results) {
        const device = byToken.get(r.token);
        if (r.success) sentCount += 1;
        else failedCount += 1;
        if (r.disableToken && device) disableIds.push(device.id);
        rows.push({
          campaignId,
          tokenId: device?.id ?? null,
          tokenFingerprint: fcmTokenFingerprint(r.token),
          status: r.success ? 'sent' : 'failed',
          error: r.success ? null : (r.errorCode || r.errorMessage || 'send_failed').slice(0, 300),
          fcmMessageId: r.messageId || null,
        });
      }
      if (rows.length) await this.prisma.pushDispatch.createMany({ data: rows });
    }

    if (disableIds.length) {
      await this.prisma.deviceFcmToken.updateMany({
        where: { id: { in: disableIds } },
        data: { enabled: false },
      });
    }

    const status = sentCount > 0 ? 'sent' : 'failed';
    const updated = await this.prisma.pushCampaign.update({
      where: { id: campaignId },
      data: {
        status,
        sentAt: new Date(),
        sentCount,
        failedCount,
        skippedCount: 0,
        errorSummary: sentCount > 0 ? null : 'Nenhum envio FCM bem-sucedido',
        firebaseReady: true,
      },
    });
    this.log.log(`Campanha ${campaignId} sent=${sentCount} failed=${failedCount}`);
    return { campaign: updated, dispatched: true, reason: 'ok' };
  }

  async testSend(opts: {
    tokenId: string;
    title?: string;
    body?: string;
    linkPath?: string;
    createdById: string;
  }) {
    const device = await this.prisma.deviceFcmToken.findUnique({ where: { id: opts.tokenId } });
    if (!device) throw new NotFoundException({ code: 'PUSH_TOKEN_NOT_FOUND', message: 'Aparelho não encontrado' });
    const parsed = validateCampaignDraft({
      title: opts.title || 'Teste Lojas Schimitz',
      body: opts.body || 'Notificação de teste no seu aparelho.',
      linkPath: opts.linkPath || '/',
      audience: 'all_enabled',
      sendMode: 'immediate',
    });
    if (!parsed.ok) {
      throw new BadRequestException({ code: parsed.code, message: parsed.message });
    }
    const campaign = await this.prisma.pushCampaign.create({
      data: {
        title: parsed.value.title,
        body: parsed.value.body,
        imageUrl: null,
        linkPath: parsed.value.linkPath,
        audience: 'all_enabled',
        status: 'sending',
        createdById: opts.createdById,
        firebaseReady: this.fcm.isConfigured(),
      },
    });

    if (!this.fcm.isConfigured()) {
      const summary = firebaseNotConfiguredSummary();
      await this.prisma.pushDispatch.create({
        data: {
          campaignId: campaign.id,
          tokenId: device.id,
          tokenFingerprint: fcmTokenFingerprint(device.token),
          status: 'skipped',
          error: summary,
        },
      });
      const updated = await this.prisma.pushCampaign.update({
        where: { id: campaign.id },
        data: {
          status: 'failed',
          sentAt: new Date(),
          skippedCount: 1,
          errorSummary: summary,
          firebaseReady: false,
        },
      });
      return { campaign: updated, sent: false, reason: 'nao_executado' };
    }

    const send = await this.fcm.sendToTokens([device.token], {
      title: parsed.value.title,
      body: parsed.value.body,
      data: fcmDataPayload({
        path: parsed.value.linkPath,
        url: parsed.value.linkUrl,
        campaignId: campaign.id,
      }),
    });
    const r = send.results[0];
    await this.prisma.pushDispatch.create({
      data: {
        campaignId: campaign.id,
        tokenId: device.id,
        tokenFingerprint: fcmTokenFingerprint(device.token),
        status: r?.success ? 'sent' : 'failed',
        error: r?.success ? null : (r?.errorCode || r?.errorMessage || 'send_failed'),
        fcmMessageId: r?.messageId || null,
      },
    });
    if (r?.disableToken) {
      await this.prisma.deviceFcmToken.update({ where: { id: device.id }, data: { enabled: false } });
    }
    const updated = await this.prisma.pushCampaign.update({
      where: { id: campaign.id },
      data: {
        status: r?.success ? 'sent' : 'failed',
        sentAt: new Date(),
        sentCount: r?.success ? 1 : 0,
        failedCount: r?.success ? 0 : 1,
        errorSummary: r?.success ? 'Envio de teste (1 aparelho)' : r?.errorMessage || 'Falha no teste',
        firebaseReady: true,
      },
    });
    return { campaign: updated, sent: Boolean(r?.success), reason: r?.success ? 'ok' : 'failed' };
  }
}
